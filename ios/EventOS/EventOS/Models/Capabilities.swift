import Foundation

/// role -> capability key -> enabled. Mirrors web/src/utils/roleStore.ts's CapMatrix.
typealias CapMatrix = [String: [String: Bool]]

struct CapabilityMeta {
    let key: String
    let label: String
    let group: String
    let description: String
    let adminLocked: Bool

    init(_ key: String, _ label: String, _ group: String, _ description: String, adminLocked: Bool = false) {
        self.key = key
        self.label = label
        self.group = group
        self.description = description
        self.adminLocked = adminLocked
    }
}

enum Capabilities {
    static let roles = ["admin", "project_lead", "director"]
    static let editableRoles = ["project_lead", "director"]

    static let roleLabels: [String: String] = [
        "admin": "Admin",
        "project_lead": "Project Lead",
        "director": "Director",
    ]

    static let groups = ["Events", "Tasks", "Team", "Templates", "Tools", "Admin"]

    static let list: [CapabilityMeta] = [
        CapabilityMeta("events.view", "View events & workspaces", "Events", "See the dashboard, calendar, and event workspaces."),
        CapabilityMeta("events.create", "Create new events", "Events", "Use \u{201c}New event\u{201d} and the SOW generator to add projects."),
        CapabilityMeta("events.edit", "Edit event details", "Events", "Update LEM, venue, SOW link, notes, and per-diem fields."),
        CapabilityMeta("events.delete", "Delete events permanently", "Events", "Remove events and their tasks from the dashboard (cannot be undone)."),
        CapabilityMeta("events.assign", "Change assigned member", "Events", "Reassign who owns an event from the workspace Overview tab."),
        CapabilityMeta("tasks.view", "View tasks", "Tasks", "Open task lists and task details inside event workspaces."),
        CapabilityMeta("tasks.manage", "Create / update tasks", "Tasks", "Add tasks, change status, upload files, and post comments."),
        CapabilityMeta("task_templates", "Task Templates page", "Tasks", "Access the reusable LEM task templates library."),
        CapabilityMeta("team.view", "View team members", "Team", "See the Team page and who is assigned to which events."),
        CapabilityMeta("templates.view", "View file templates", "Templates", "Browse org-wide reference files and template attachments."),
        CapabilityMeta("templates.manage", "Upload / delete templates", "Templates", "Add or remove files on the Org Templates page."),
        CapabilityMeta("designs", "Designs (badges, certs\u{2026})", "Tools", "Open the Designs workspace for badges, certificates, and banners."),
        CapabilityMeta("generators", "Generators hub", "Tools", "Access transfer lists, AV lists, and other generators."),
        CapabilityMeta("sow_generator", "SOW Event Generator", "Tools", "Parse SOW PDFs and create fully templated events."),
        CapabilityMeta("admin_panel", "Admin Panel", "Admin", "Manage members and role permissions (admins only).", adminLocked: true),
    ]

    static func caps(in group: String) -> [CapabilityMeta] {
        list.filter { $0.group == group }
    }

    private static let defaultMatrix: CapMatrix = {
        var admin: [String: Bool] = [:]
        for cap in list { admin[cap.key] = true }
        return [
            "admin": admin,
            "project_lead": [
                "events.view": true, "events.create": true, "events.edit": true,
                "events.delete": false, "events.assign": false,
                "tasks.view": true, "tasks.manage": true, "task_templates": false,
                "team.view": true,
                "templates.view": true, "templates.manage": false,
                "designs": true, "generators": true, "sow_generator": false,
                "admin_panel": false,
            ],
            "director": [
                "events.view": true, "events.create": false, "events.edit": false,
                "events.delete": false, "events.assign": false,
                "tasks.view": true, "tasks.manage": false, "task_templates": false,
                "team.view": true,
                "templates.view": true, "templates.manage": false,
                "designs": true, "generators": false, "sow_generator": false,
                "admin_panel": false,
            ],
        ]
    }()

    /// Merges a stored matrix (possibly nil, possibly missing newer keys) over the defaults,
    /// mirroring roleStore.ts's normalizeCapMatrix. Admin is always fully-on.
    static func normalize(_ stored: CapMatrix?) -> CapMatrix {
        var merged = defaultMatrix
        guard let stored else { return merged }
        for role in editableRoles {
            guard let saved = stored[role] else { continue }
            for cap in list {
                if let value = saved[cap.key] {
                    merged[role]?[cap.key] = value
                }
            }
        }
        return merged
    }
}
