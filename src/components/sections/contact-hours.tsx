import {
  SHOP_CITY,
  SHOP_EMAIL,
  SHOP_MAPS_URL,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_E164,
  SHOP_POSTAL_CODE,
  SHOP_STREET,
  SHOP_SOCIAL_PROFILES,
} from "@/lib/business-info";
import { OpeningHoursList } from "@/components/sections/opening-hours";

const INSTAGRAM_URL = SHOP_SOCIAL_PROFILES[0];
const FACEBOOK_URL = SHOP_SOCIAL_PROFILES[1];

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function ContactInfo() {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Kontakt
      </h3>
      <address className="mt-3 space-y-2.5 text-[15px] not-italic leading-snug">
        <a
          href={SHOP_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block underline-offset-2 hover:underline"
        >
          <span className="block">{SHOP_STREET}</span>
          <span className="block text-muted-foreground">
            {SHOP_POSTAL_CODE.slice(0, 3)} {SHOP_POSTAL_CODE.slice(3)}{" "}
            {SHOP_CITY}
          </span>
        </a>
        <a
          href={`tel:${SHOP_PHONE_E164}`}
          className="block tabular-nums underline-offset-2 hover:underline"
        >
          {SHOP_PHONE_DISPLAY}
        </a>
        <a
          href={`mailto:${SHOP_EMAIL}`}
          className="inline-block max-w-full text-[14px] underline-offset-2 [overflow-wrap:anywhere] hover:underline"
        >
          {(() => {
            const at = SHOP_EMAIL.indexOf("@");
            return (
              <>
                {SHOP_EMAIL.slice(0, at)}
                <wbr />
                {SHOP_EMAIL.slice(at)}
              </>
            );
          })()}
        </a>
      </address>
      <div className="mt-4 flex items-center gap-2">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Strojček na Instagrame"
          className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
        >
          <InstagramIcon className="size-4" />
        </a>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Strojček na Facebooku"
          className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
        >
          <FacebookIcon className="size-4" />
        </a>
      </div>
    </div>
  );
}

interface ContactHoursGridProps {
  hours: Array<{ dayOfWeek: string; opens: string; closes: string }>;
  className?: string;
}

export function ContactHoursGrid({
  hours,
  className = "grid gap-8 sm:grid-cols-2 sm:gap-10",
}: ContactHoursGridProps) {
  return (
    <div className={className}>
      <ContactInfo />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Otváracie hodiny
        </h3>
        <OpeningHoursList hours={hours} />
      </div>
    </div>
  );
}
