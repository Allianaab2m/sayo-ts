import { Schema } from "effect"

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
  "UserNotFound",
  { userId: Schema.String },
) {}

export class EmailAlreadyTaken extends Schema.TaggedErrorClass<EmailAlreadyTaken>()(
  "EmailAlreadyTaken",
  { email: Schema.String },
) {}
