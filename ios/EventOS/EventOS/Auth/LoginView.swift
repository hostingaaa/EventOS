import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AuthViewModel()
    @FocusState private var focusedField: Field?

    enum Field { case email, password, confirm, name }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                brand

                VStack(spacing: 16) {
                    switch vm.step {
                    case .email: emailStep
                    case .password: passwordStep
                    case .notFound: notFoundStep
                    case .register: registerStep
                    }
                }
                .cardStyle(padding: 24)
            }
            .padding(24)
            .frame(maxWidth: 420)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg)
    }

    private var brand: some View {
        EventOSLogoView(size: 56)
            .padding(.top, 40)
    }

    private var errorText: some View {
        Group {
            if let error = vm.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Theme.statusRisk)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text).font(.caption).foregroundStyle(Theme.textSecondary)
    }

    private func styledField() -> some View {
        RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous)
            .fill(Theme.cardAlt)
    }

    private var emailStep: some View {
        VStack(spacing: 16) {
            Text("Welcome to EventOS").font(.title2.bold()).foregroundStyle(Theme.textPrimary)
            Text("Don't have an account? Enter your email to get started.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("Work email")
                TextField("name@company.com", text: $vm.email)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(styledField())
                    .foregroundStyle(Theme.textPrimary)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.continue)
                    .onSubmit { Task { await vm.continueWithEmail() } }
            }

            errorText

            Button {
                Task { await vm.continueWithEmail() }
            } label: {
                if vm.loading {
                    ProgressView().tint(.black).frame(maxWidth: .infinity)
                } else {
                    Text("Continue to EventOS").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(StakePrimaryButtonStyle())
            .disabled(vm.loading)
        }
        .onAppear { focusedField = .email }
    }

    private var passwordStep: some View {
        VStack(spacing: 16) {
            backButton(action: vm.goBackToEmail)
            Text("Welcome back").font(.title2.bold()).foregroundStyle(Theme.textPrimary)
            Text(vm.email).font(.footnote).foregroundStyle(Theme.textSecondary)

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("Password")
                SecureField("Enter your password", text: $vm.password)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(styledField())
                    .foregroundStyle(Theme.textPrimary)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { Task { await vm.signIn(session: session) } }
            }

            errorText

            Button {
                Task { await vm.signIn(session: session) }
            } label: {
                if vm.loading {
                    ProgressView().tint(.black).frame(maxWidth: .infinity)
                } else {
                    Text("Sign in").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(StakePrimaryButtonStyle())
            .disabled(vm.loading)
        }
        .onAppear { focusedField = .password }
    }

    private var notFoundStep: some View {
        VStack(spacing: 16) {
            backButton(action: vm.goBackToEmail)
            Text("No account found").font(.title2.bold()).foregroundStyle(Theme.textPrimary)
            Text("We couldn't find an account for **\(vm.email)**.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)

            errorText

            Button {
                vm.error = nil
                vm.step = .register
            } label: {
                Text("Create an account").frame(maxWidth: .infinity)
            }
            .buttonStyle(StakePrimaryButtonStyle())
        }
    }

    private var registerStep: some View {
        VStack(spacing: 16) {
            backButton { vm.step = .notFound }
            Text("Create your account").font(.title2.bold()).foregroundStyle(Theme.textPrimary)
            Text(vm.email).font(.footnote).foregroundStyle(Theme.textSecondary)

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("Full name")
                TextField("Jane Doe", text: $vm.name)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(styledField())
                    .foregroundStyle(Theme.textPrimary)
                    .focused($focusedField, equals: .name)
            }

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("Password")
                SecureField("At least 8 characters", text: $vm.password)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(styledField())
                    .foregroundStyle(Theme.textPrimary)
                    .focused($focusedField, equals: .password)
            }

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("Confirm password")
                SecureField("Repeat password", text: $vm.confirmPassword)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(styledField())
                    .foregroundStyle(Theme.textPrimary)
                    .focused($focusedField, equals: .confirm)
                    .submitLabel(.go)
                    .onSubmit { Task { await vm.register(session: session) } }
            }

            errorText

            Button {
                Task { await vm.register(session: session) }
            } label: {
                if vm.loading {
                    ProgressView().tint(.black).frame(maxWidth: .infinity)
                } else {
                    Text("Create account").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(StakePrimaryButtonStyle())
            .disabled(vm.loading)
        }
        .onAppear { focusedField = .name }
    }

    private func backButton(action: @escaping () -> Void) -> some View {
        HStack {
            Button(action: action) {
                Label("Back", systemImage: "chevron.left")
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
        }
    }
}

/// Bright green pill button, mirroring Stake's primary CTAs ("Continue to EventOS", "Browse", "Invest").
struct StakePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.black)
            .padding(.vertical, 14)
            .background(Theme.green)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

#Preview {
    LoginView().environmentObject(SessionStore())
}
