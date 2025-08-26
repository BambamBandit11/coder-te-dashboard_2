export default function handler(req, res) {
  const providers = {
    google: {
      id: "google",
      name: "Google",
      type: "oauth",
      signinUrl: "/api/auth/signin/google",
      callbackUrl: "/api/auth/callback/google"
    }
  }
  res.status(200).json(providers)
}
