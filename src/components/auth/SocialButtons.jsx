import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/GoogleIcon";

// Enabled providers for this app: Email+password (handled by forms), Google, Microsoft, Facebook, Apple.
const MicrosoftIcon = (props) => (
  <svg viewBox="0 0 21 21" className={props.className} aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} aria-hidden="true" fill="#1877F2">
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.97 10.13 11.85v-8.38H7.08v-3.47h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.04 24 18.07 24 12.07z" />
  </svg>
);

const AppleIcon = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} aria-hidden="true" fill="currentColor">
    <path d="M16.37 1.43c0 1.14-.42 2.27-1.25 3.1-.84.85-2.04 1.5-3.18 1.41-.14-1.1.42-2.27 1.19-3.04.84-.86 2.13-1.47 3.24-1.47zM20.5 17.2c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.01-3.05-1.76-4.04-3.32C-.04 16.97-.32 11.92 1.4 9.24c1.22-1.91 3.16-3.03 4.98-3.03 1.85 0 3.01 1.01 4.54 1.01 1.49 0 2.39-1.01 4.54-1.01 1.62 0 3.34.88 4.56 2.4-4.01 2.2-3.36 7.92.98 8.59z" />
  </svg>
);

const PROVIDERS = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "microsoft", label: "Continue with Microsoft", Icon: MicrosoftIcon },
  { id: "facebook", label: "Continue with Facebook", Icon: FacebookIcon },
  { id: "apple", label: "Continue with Apple", Icon: AppleIcon },
];

export default function SocialButtons() {
  const handleProvider = (provider) => {
    base44.auth.loginWithProvider(provider, "/dashboard");
  };

  return (
    <div className="space-y-3 mb-6">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={() => handleProvider(id)}
        >
          <Icon className="w-5 h-5 mr-2" />
          {label}
        </Button>
      ))}
    </div>
  );
}