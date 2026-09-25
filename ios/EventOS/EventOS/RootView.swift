import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if !session.isReady {
                EventOSSplashView()
            } else if session.user != nil {
                RootTabView()
            } else {
                LoginView()
            }
        }
    }
}

struct RootTabView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        TabView {
            NavigationStack {
                DashboardView()
            }
            .tabItem { Label("Home", systemImage: "house.fill") }

            NavigationStack {
                TeamView()
            }
            .tabItem { Label("Team", systemImage: "person.2.fill") }

            if session.user?.isAdmin == true {
                NavigationStack {
                    ReportsView()
                }
                .tabItem { Label("Reports", systemImage: "chart.bar.fill") }

                NavigationStack {
                    AdminPanelView()
                }
                .tabItem { Label("Admin", systemImage: "person.badge.key.fill") }
            }
        }
        .tint(Theme.green)
    }
}
