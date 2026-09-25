import Foundation

struct TeamUser: Codable, Equatable {
    var name: String
    var email: String
    var isAdmin: Bool = false
}

@MainActor
final class SessionStore: ObservableObject {
    private static let key = "event-ops-user"

    @Published private(set) var user: TeamUser?
    @Published private(set) var isReady = false

    init() {
        if let data = Keychain.load(key: Self.key), let cached = try? JSONDecoder().decode(TeamUser.self, from: data) {
            user = cached
        }
        isReady = true
        Task { await refreshWhoAmI() }
    }

    func signIn(name: String, email: String) {
        let account = TeamUser(name: name, email: email)
        user = account
        persist(account)
        Task { await refreshWhoAmI() }
    }

    func signOut() {
        user = nil
        Keychain.delete(key: Self.key)
    }

    private func persist(_ account: TeamUser) {
        if let data = try? JSONEncoder().encode(account) {
            Keychain.save(data, key: Self.key)
        }
    }

    private func refreshWhoAmI() async {
        guard let current = user else { return }
        guard let result = try? await EventOSService.whoami(actorEmail: current.email) else { return }
        var updated = current
        updated.isAdmin = result.isAdmin
        user = updated
        persist(updated)
    }
}
