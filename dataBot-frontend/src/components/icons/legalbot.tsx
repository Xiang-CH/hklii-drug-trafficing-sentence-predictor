import type { SVGProps } from "react";

export function LegalBotLogoSVG(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="legalbotTitle legalbotDesc"
      {...props}
    >
      <title id="legalbotTitle">LegalBot Icon</title>
      <desc id="legalbotDesc">
        A legal chatbot icon combining a speech bubble, scales of justice, and an HKU-inspired shield motif.
      </desc>
      <path
        d="M12 16C12 10.477 16.477 6 22 6H42C47.523 6 52 10.477 52 16V34C52 39.523 47.523 44 42 44H31.2L20.6 54.6C19.34 55.86 17.185 54.968 17.185 53.186V43.228C14.133 41.557 12 38.315 12 34.5V16Z"
        fill="currentColor"
      />
      <path d="M20 17.5H44" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.95" />
      <path d="M32 16V35" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 21L18.5 31H29.5L24 21Z" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M40 21L34.5 31H45.5L40 21Z" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M18.5 31C19.3 34.1 21.2 35.8 24 35.8C26.8 35.8 28.7 34.1 29.5 31" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M34.5 31C35.3 34.1 37.2 35.8 40 35.8C42.8 35.8 44.7 34.1 45.5 31" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M26.2 41H37.8" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 46.5L27.5 42.8V38.4H36.5V42.8L32 46.5Z" fill="white" opacity="0.96" />
      <path d="M32 41.2L29.8 39.4H34.2L32 41.2Z" fill="currentColor" opacity="0.9" />
    </svg>
  );
}
