import type { CharacterProps } from "./types";
export default function Pet({ status, onInteract }: CharacterProps) {
  return (
    <button
      className="character-button pet-character"
      aria-label="和年糕互动"
      onClick={onInteract}
    >
      <svg
        viewBox="0 0 280 250"
        fill="none"
        role="img"
        aria-label="年糕，一只戴着薄荷绿围巾的奶油猫"
      >
        <defs>
          <linearGradient
            id="catFur"
            x1="85"
            y1="45"
            x2="190"
            y2="228"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFFDF8" />
            <stop offset="1" stopColor="#F0E4D6" />
          </linearGradient>
          <linearGradient
            id="scarf"
            x1="95"
            y1="152"
            x2="186"
            y2="205"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9FDBC1" />
            <stop offset="1" stopColor="#65AC91" />
          </linearGradient>
        </defs>
        <ellipse
          cx="139"
          cy="232"
          rx="77"
          ry="11"
          fill="#465C55"
          opacity=".13"
        />
        <g className="character-sway">
          <path
            className="cat-tail"
            d="M190 202C230 222 258 187 238 167C227 156 216 169 224 179"
            stroke="#E4D5C5"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M91 162C77 182 77 216 96 225C119 235 168 234 185 221C201 207 194 177 179 162"
            fill="url(#catFur)"
            stroke="#D6C6B6"
            strokeWidth="2.5"
          />
          <ellipse cx="139" cy="197" rx="30" ry="29" fill="#FFFDF8" />
          <path
            d="M94 203L88 222C88 234 116 235 121 226M161 225C167 235 191 231 191 221L183 203"
            fill="#F8F1E7"
            stroke="#D6C6B6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <g className="cat-head">
            <path
              d="M68 98C61 77 62 44 75 31C83 26 105 47 115 54C132 49 152 49 169 54C185 38 202 29 209 35C218 49 220 77 211 100C234 136 218 164 193 174C168 185 108 187 80 172C51 158 47 128 68 98Z"
              fill="url(#catFur)"
              stroke="#D6C6B6"
              strokeWidth="2.5"
            />
            <path d="M74 84L77 45L103 65Z" fill="#EFC0BB" />
            <path d="M182 64L204 46L207 86Z" fill="#EFC0BB" />
            <path
              d="M120 56L124 75M139 53V72M158 55L154 74"
              stroke="#E5D7C6"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <ellipse
              cx="82"
              cy="139"
              rx="16"
              ry="8"
              fill="#EDBCB2"
              opacity=".7"
            />
            <ellipse
              cx="195"
              cy="139"
              rx="16"
              ry="8"
              fill="#EDBCB2"
              opacity=".7"
            />
            <g className="blink-eyes">
              <ellipse cx="104" cy="121" rx="6.5" ry="10" fill="#4D4D48" />
              <ellipse cx="175" cy="121" rx="6.5" ry="10" fill="#4D4D48" />
              <circle cx="106" cy="117" r="2" fill="white" />
              <circle cx="177" cy="117" r="2" fill="white" />
            </g>
            <path d="M133 136Q139 131 145 136L139 142Z" fill="#BE8E87" />
            <path
              d="M139 142C139 155 124 152 126 145M139 142C139 155 154 152 152 145"
              stroke="#79695E"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M60 131L78 134M59 145L78 142M203 133L221 129M203 142L223 146"
              stroke="#CBB6A4"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          <path
            d="M91 171Q139 189 187 170L187 185Q140 203 91 186Z"
            fill="url(#scarf)"
            stroke="#73AC93"
            strokeWidth="2"
          />
          <path
            d="M158 184L174 183L181 210Q169 218 158 208Z"
            fill="#85C6AA"
            stroke="#73AC93"
            strokeWidth="2"
          />
          <path d="M163 204L176 203" stroke="#D9F3E7" strokeWidth="3" />
          <circle cx="135" cy="189" r="6" fill="#E7C67A" />
          <path d="M132 189H138" stroke="#A68F53" strokeWidth="1.5" />
        </g>
        {status === "finished" && (
          <g className="floating-sparkle" fill="#D7C077">
            <path d="M234 75L238 86L249 90L238 94L234 105L230 94L219 90L230 86Z" />
            <path d="M41 93L43 100L50 103L43 106L41 113L38 106L32 103L38 100Z" />
          </g>
        )}
      </svg>
    </button>
  );
}
