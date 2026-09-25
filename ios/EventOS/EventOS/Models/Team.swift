import Foundation

struct TeamMember: Codable, Identifiable {
    var email: String
    var name: String
    var tasks: [EventTask]

    var id: String { email.isEmpty ? name : email }
}

struct TeamOverview: Codable {
    var members: [TeamMember]
    var totalTasks: Int
    var openTasks: Int
}

struct WhoAmI: Codable {
    var isAdmin: Bool
    var email: String
}

struct AuthAccount: Codable, Equatable {
    var id: String
    var name: String
    var email: String
    var passwordHash: String
    var createdAt: String
}

struct OrgMember: Codable, Identifiable {
    var id: String
    var name: String
    var email: String
    var role: String
    var status: String
    var createdAt: String
    var invitedBy: String
}
