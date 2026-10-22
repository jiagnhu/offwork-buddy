import type { CharacterProps } from "./types";
export default function Accessories({
  accessory,
  pose,
}: Pick<CharacterProps, "accessory" | "pose">) {
  return (
    <g className="buddy-accessory">
      {accessory === "star" && (
        <path
          d="M204 49l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z"
          fill="#F2CC70"
          stroke="#B9984F"
          strokeWidth="2"
        />
      )}
      {accessory === "pillow" && (
        <g transform="rotate(-8 140 208)">
          <rect
            x="108"
            y="182"
            width="64"
            height="49"
            rx="14"
            fill="#D5C6ED"
            stroke="#A594C0"
            strokeWidth="2"
          />
          <path
            d="M118 190q22 9 43 0M118 221q22-9 43 0"
            stroke="#F4ECFF"
            strokeWidth="3"
          />
          <path d="M132 204q8 10 16 0" stroke="#A594C0" strokeWidth="2" />
        </g>
      )}
      {pose === "sleep" && (
        <g stroke="#A594C0" strokeWidth="3" strokeLinecap="round">
          <path d="M211 105h12l-12 13h12M229 81h16l-16 17h16" />
        </g>
      )}
      {pose === "celebrate" && (
        <g fill="#E8BA64">
          <path d="M38 62l4 13 14 3-14 5-4 13-4-13-13-5 13-3zM235 130l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" />
          <circle cx="54" cy="150" r="4" />
          <circle cx="220" cy="37" r="4" />
        </g>
      )}
    </g>
  );
}
