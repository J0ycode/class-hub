// Original cartoon "sticker" logos for each subject, drawn as inline SVG
// (no external images, so nothing to license or download).

type Kind = "dsa" | "digital" | "economics" | "ethics" | "maths" | "oop" | "toc" | "book";

const INK = "#2b2233";

function kindFor(name: string, code?: string): Kind {
  const c = (code ?? "").toUpperCase();
  const n = name.toUpperCase();
  if (c === "PCCST303" || n.includes("DATA STRUCTURE")) return "dsa";
  if (c === "GAEST305" || n.includes("DIGITAL") || n.includes("LOGIC DESIGN")) return "digital";
  if (c === "UCHUT346" || n.includes("ECONOMIC")) return "economics";
  if (c === "UCHUT347" || n.includes("ETHIC")) return "ethics";
  if (c === "GAMAT301" || n.includes("MATHEMATIC")) return "maths";
  if (c === "PBCST304" || n.includes("OBJECT ORIENTED")) return "oop";
  if (c === "PCCST302" || n.includes("COMPUTATION")) return "toc";
  return "book";
}

const BG: Record<Kind, string> = {
  dsa: "#c9d4ff",
  digital: "#bff0d8",
  economics: "#ffe3a8",
  ethics: "#d8f5c4",
  maths: "#ffd0e0",
  oop: "#e2d4ff",
  toc: "#c8eeff",
  book: "#f1e4cf",
};

/** Two dot eyes and a small smile, centred on (x, y). */
function Face({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g fill={INK} stroke={INK}>
      <circle cx={x - 3.2 * s} cy={y} r={1.3 * s} stroke="none" />
      <circle cx={x + 3.2 * s} cy={y} r={1.3 * s} stroke="none" />
      <path d={`M${x - 2.4 * s} ${y + 2.6 * s} q${2.4 * s} ${2.2 * s} ${4.8 * s} 0`} fill="none" strokeWidth={1.4 * s} strokeLinecap="round" />
    </g>
  );
}

function Art({ kind }: { kind: Kind }) {
  const line = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (kind) {
    case "dsa":
      return (
        <g {...line}>
          <path d="M32 22 L20 38 M32 22 L44 38 M20 38 L14 50 M20 38 L26 50" fill="none" />
          <circle cx="32" cy="20" r="9" fill="#ff9f6b" />
          <circle cx="20" cy="38" r="6.5" fill="#6fd6a8" />
          <circle cx="44" cy="38" r="6.5" fill="#8e9bff" />
          <circle cx="14" cy="50" r="4.5" fill="#ffd36b" />
          <circle cx="26" cy="50" r="4.5" fill="#ffd36b" />
          <Face x={32} y={19} s={0.9} />
        </g>
      );
    case "digital":
      return (
        <g {...line}>
          {[20, 28, 36, 44].map((y) => (
            <path key={`l${y}`} d={`M12 ${y} h6 M46 ${y} h6`} fill="none" />
          ))}
          <rect x="18" y="14" width="28" height="36" rx="6" fill="#4b5d73" />
          <rect x="23" y="19" width="18" height="18" rx="4" fill="#7ee0c0" />
          <Face x={32} y={27} s={0.95} />
          <circle cx="24" cy="44" r="1.6" fill="#ffd36b" stroke="none" />
        </g>
      );
    case "economics":
      return (
        <g {...line}>
          <ellipse cx="24" cy="46" rx="11" ry="4.5" fill="#f3b76a" />
          <path d="M13 46 v-6 M35 46 v-6" fill="none" />
          <ellipse cx="24" cy="40" rx="11" ry="4.5" fill="#ffd36b" />
          <path d="M13 40 v-6 M35 40 v-6" fill="none" />
          <ellipse cx="24" cy="34" rx="11" ry="4.5" fill="#ffe08a" />
          <text x="24" y="36.5" textAnchor="middle" fontSize="7" fontWeight="800" fill={INK} stroke="none">₹</text>
          <path d="M34 30 L42 22 L46 26 L54 16" fill="none" stroke="#2fa36b" strokeWidth="3.2" />
          <path d="M48 15 h6 v6" fill="none" stroke="#2fa36b" strokeWidth="3.2" />
        </g>
      );
    case "ethics":
      return (
        <g {...line}>
          <path d="M32 14 V48 M22 50 h20" fill="none" />
          <path d="M16 22 H48" fill="none" />
          <path d="M16 22 L10 36 M16 22 L22 36 M48 22 L42 36 M48 22 L54 36" fill="none" strokeWidth="1.6" />
          <path d="M9 36 h14 a7 5 0 0 1 -14 0 z" fill="#8e9bff" />
          <path d="M41 36 h14 a7 5 0 0 1 -14 0 z" fill="#8e9bff" />
          <circle cx="32" cy="14" r="3.4" fill="#ffd36b" />
          <path d="M47 33 c-4 -7 3 -12 8 -11 c1 6 -3 11 -8 11 z" fill="#5fc47e" />
          <path d="M47 33 l5 -6" fill="none" strokeWidth="1.4" />
        </g>
      );
    case "maths":
      return (
        <g {...line}>
          <rect x="14" y="14" width="36" height="36" rx="10" fill="#ff8fb1" />
          <path d="M22 26 h20 M28 26 v15 M37 26 v12 q0 4 4 3" fill="none" stroke="#fff" strokeWidth="3.6" />
          <path d="M22 26 h20 M28 26 v15 M37 26 v12 q0 4 4 3" fill="none" stroke={INK} strokeWidth="1.2" />
          <Face x={32} y={45} s={0.75} />
          <path d="M50 12 v6 M47 15 h6" fill="none" stroke="#f3b76a" strokeWidth="2.4" />
          <path d="M10 48 h5" fill="none" stroke="#6fa8ff" strokeWidth="2.4" />
        </g>
      );
    case "oop":
      return (
        <g {...line}>
          <path d="M32 12 L52 22 L32 32 L12 22 Z" fill="#c3b1ff" />
          <path d="M12 22 V42 L32 52 V32 Z" fill="#9d86f5" />
          <path d="M52 22 V42 L32 52 V32 Z" fill="#7f66e8" />
          <text x="22" y="42" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" stroke="none">{"{"}</text>
          <text x="42" y="42" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" stroke="none">{"}"}</text>
          <Face x={32} y={21} s={0.8} />
        </g>
      );
    case "toc":
      return (
        <g {...line}>
          <path d="M8 32 h6" fill="none" />
          <path d="M13 29 l3 3 l-3 3" fill="none" />
          <circle cx="23" cy="32" r="8" fill="#6fa8ff" />
          <path d="M31 28 q9 -9 16 0" fill="none" />
          <path d="M44 25 l3 3 l-4 1" fill="none" />
          <path d="M47 36 q-8 9 -16 0" fill="none" />
          <circle cx="47" cy="32" r="9" fill="#ffd36b" />
          <circle cx="47" cy="32" r="6" fill="none" />
          <text x="39" y="20" textAnchor="middle" fontSize="7" fontWeight="800" fill={INK} stroke="none">a</text>
          <text x="39" y="49" textAnchor="middle" fontSize="7" fontWeight="800" fill={INK} stroke="none">b</text>
          <Face x={23} y={31} s={0.7} />
        </g>
      );
    default:
      return (
        <g {...line}>
          <path d="M14 18 q9 -4 18 2 q9 -6 18 -2 v28 q-9 -4 -18 2 q-9 -6 -18 -2 z" fill="#fff4dc" />
          <path d="M32 20 v28" fill="none" />
          <Face x={23} y={31} s={0.7} />
        </g>
      );
  }
}

export default function SubjectSticker({
  name,
  code,
  size = "md",
}: {
  name: string;
  code?: string;
  size?: "md" | "lg";
}) {
  const kind = kindFor(name, code);
  return (
    <span className={`sticker sticker-${size}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <rect x="3" y="3" width="58" height="58" rx="18" fill={BG[kind]} stroke="#fff" strokeWidth="4" />
        <Art kind={kind} />
      </svg>
    </span>
  );
}
