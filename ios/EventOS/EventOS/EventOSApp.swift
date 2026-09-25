import SwiftUI

@main
struct EventOSApp: App {
    @StateObject private var session = SessionStore()

    init() {
        configureAppearance()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .preferredColorScheme(.dark)
        }
    }

    private func configureAppearance() {
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(Theme.bg)
        let tabItem = tabAppearance.stackedLayoutAppearance
        tabItem.normal.iconColor = UIColor(Theme.textTertiary)
        tabItem.normal.titleTextAttributes = [.foregroundColor: UIColor(Theme.textTertiary)]
        tabItem.selected.iconColor = UIColor(Theme.green)
        tabItem.selected.titleTextAttributes = [.foregroundColor: UIColor(Theme.green)]
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance

        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(Theme.bg)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(Theme.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(Theme.textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().tintColor = UIColor(Theme.green)

        UITableView.appearance().backgroundColor = UIColor(Theme.bg)
    }
}
