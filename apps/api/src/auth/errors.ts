export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class LoginRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many login attempts. Try again later");
    this.name = "LoginRateLimitError";
  }
}
