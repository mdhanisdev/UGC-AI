 import * as Sentry from "@sentry/node";


Sentry.init({
  dsn: "https://c25fbdb883160e8f247bb32f86b1947c@o4511230800756736.ingest.us.sentry.io/4511230805934081",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});