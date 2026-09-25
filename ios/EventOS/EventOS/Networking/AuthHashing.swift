import Foundation
import CryptoKit

/// Mirrors web/src/utils/authStore.ts hashPassword — same salt and input format
/// so accounts created on web can sign in from iOS and vice versa.
enum AuthHashing {
    private static let salt = "evos-2026-cm"

    static func hashPassword(email: String, password: String) -> String {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let input = "\(normalizedEmail):\(salt):\(password)"
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
