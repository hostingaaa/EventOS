import Foundation

enum AuthStep {
    case email, password, notFound, register
}

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var step: AuthStep = .email
    @Published var email = ""
    @Published var name = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var loading = false
    @Published var error: String?

    func continueWithEmail() async {
        error = nil
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard trimmed.contains("@") else {
            error = "Please enter a valid email address."
            return
        }
        loading = true
        defer { loading = false }
        do {
            let exists = try await EventOSService.authCheckEmail(trimmed)
            email = trimmed
            step = exists ? .password : .notFound
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signIn(session: SessionStore) async {
        error = nil
        guard !password.isEmpty else {
            error = "Please enter your password."
            return
        }
        loading = true
        defer { loading = false }
        let hash = AuthHashing.hashPassword(email: email, password: password)
        do {
            guard let account = try await EventOSService.authLogin(email: email, passwordHash: hash) else {
                error = "Incorrect password. Please try again."
                return
            }
            session.signIn(name: account.name, email: account.email)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func register(session: SessionStore) async {
        error = nil
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = "Please enter your full name."
            return
        }
        guard password.count >= 8 else {
            error = "Password must be at least 8 characters."
            return
        }
        guard password == confirmPassword else {
            error = "Passwords do not match."
            return
        }
        loading = true
        defer { loading = false }
        let hash = AuthHashing.hashPassword(email: email, password: password)
        do {
            let account = try await EventOSService.authRegister(name: name.trimmingCharacters(in: .whitespacesAndNewlines), email: email, passwordHash: hash)
            session.signIn(name: account.name, email: account.email)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func goBackToEmail() {
        error = nil
        password = ""
        confirmPassword = ""
        step = .email
    }
}
