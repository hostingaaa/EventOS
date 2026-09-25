import Foundation

struct APIError: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private struct ErrorEnvelope: Codable {
    var error: String?
}

/// GAS redirects to script.googleusercontent.com, which advertises HTTP/3 (QUIC). QUIC's UDP
/// path can hang indefinitely in the Simulator's networking stack, so this delegate strips the
/// HTTP/3 upgrade from the redirected request too (assumesHTTP3Capable on the original request
/// only covers that request — it isn't inherited by the request the redirect hands back).
private final class NoHTTP3RedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        var next = request
        next.assumesHTTP3Capable = false
        completionHandler(next)
    }
}

/// Talks to the same Google Apps Script action-dispatch web app as web/src/api/client.ts.
/// Unlike the web client, there's no CORS to dodge here, so every write goes out as a
/// real HTTP POST (which satisfies both the GAS actions that accept GET+payload and the
/// ones — authLogin, commentAdd — that require a literal POST method server-side).
enum APIClient {
    private static let base = Secrets.apiURL
    private static let token = Secrets.apiToken
    private static let session = URLSession(configuration: .default, delegate: NoHTTP3RedirectDelegate(), delegateQueue: nil)

    private static func getURL(_ action: String, _ params: [String: String] = [:]) -> URL {
        var components = URLComponents(string: base)!
        var items = [URLQueryItem(name: "action", value: action), URLQueryItem(name: "token", value: token)]
        for (key, value) in params { items.append(URLQueryItem(name: key, value: value)) }
        components.queryItems = items
        return components.url!
    }

    /// GAS redirects to script.googleusercontent.com, which advertises HTTP/3 (QUIC).
    /// QUIC's UDP path can hang indefinitely in the Simulator's networking stack, so every
    /// request disables the HTTP/3 upgrade attempt and falls back to plain HTTP/2 over TCP.
    private static func makeRequest(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.assumesHTTP3Capable = false
        return request
    }

    static func get<T: Decodable>(_ action: String, _ params: [String: String] = [:]) async throws -> T {
        let (data, response) = try await session.data(for: makeRequest(getURL(action, params)))
        return try decode(data, response)
    }

    static func post<T: Decodable>(_ action: String, _ body: [String: Any]) async throws -> T {
        var fullBody: [String: Any] = ["action": action, "token": token]
        for (key, value) in body { fullBody[key] = value }
        let payload = try JSONSerialization.data(withJSONObject: fullBody)

        var request = makeRequest(URL(string: base)!)
        request.httpMethod = "POST"
        request.setValue("text/plain;charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = payload

        let (data, response) = try await session.data(for: request)
        return try decode(data, response)
    }

    private static func decode<T: Decodable>(_ data: Data, _ response: URLResponse) throws -> T {
        if let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data), let message = envelope.error {
            throw APIError(message: message)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            let snippet = String(data: data.prefix(200), encoding: .utf8) ?? ""
            throw APIError(message: "Unexpected response: \(snippet)")
        }
    }
}
