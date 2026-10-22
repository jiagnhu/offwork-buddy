import Accessories from './Accessories';
import type { CharacterProps } from "./types";
export default function Assistant({ onInteract, pose='idle', direction='right', accessory='none' }: CharacterProps) {
  return (
    <button
      className="character-button assistant-character"
      data-pose={pose} data-direction={direction} data-accessory={accessory}
      aria-label="和小沐互动"
      onClick={onInteract}
    >
      <svg
        viewBox="0 0 280 300"
        fill="none"
        role="img"
        aria-label="小沐，淡紫长发的桌面看板娘"
      >
        <defs>
          <linearGradient
            id="hair"
            x1="79"
            y1="37"
            x2="197"
            y2="201"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#C6B9E5" />
            <stop offset="1" stopColor="#8C7CAF" />
          </linearGradient>
          <linearGradient
            id="dress"
            x1="110"
            y1="161"
            x2="171"
            y2="253"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#4C6866" />
            <stop offset="1" stopColor="#344A51" />
          </linearGradient>
          <linearGradient
            id="eyes"
            x1="0"
            y1="107"
            x2="0"
            y2="134"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#5B486E" />
            <stop offset="1" stopColor="#A99AC8" />
          </linearGradient>
        </defs>
        <ellipse
          cx="140"
          cy="285"
          rx="62"
          ry="9"
          fill="#465C55"
          opacity=".14"
        />
        <g className="character-sway">
          <g className="hair-sway">
            <path
              d="M85 67C53 80 49 143 61 185L48 211C73 213 89 193 94 160L100 86Z"
              fill="url(#hair)"
              stroke="#897CA6"
              strokeWidth="2"
            />
            <path
              d="M194 65C223 83 231 150 218 187L230 210C205 211 191 192 187 157L181 86Z"
              fill="url(#hair)"
              stroke="#897CA6"
              strokeWidth="2"
            />
            <path
              d="M64 110Q56 168 68 189M213 110Q223 164 210 190"
              stroke="#D9CFF0"
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".6"
            />
          </g>
          <g className="buddy-legs"><path
            d="M116 242L119 277L131 279L135 245M148 245L151 279L164 277L166 242"
            fill="#F7DECF"
            stroke="#CFAF9F"
            strokeWidth="1.5"
          />
          <path
            d="M118 262L119 277L131 279L132 263M150 263L151 279L164 277L165 262"
            fill="#F7F5FB"
          />
          <path
            d="M118 274C112 275 108 281 112 285L133 285L132 276M151 276L150 285L173 285C177 280 169 275 163 274"
            fill="#4D515F"
          />
          </g><g className="buddy-arms"><path
            d="M107 171Q92 178 86 204L97 212L113 191M174 172Q191 178 196 201L184 209L170 190"
            fill="#F8F4FC"
            stroke="#C8BFDA"
            strokeWidth="2"
          />
          <path
            d="M86 202C78 213 79 222 86 223C92 223 96 213 98 209M185 204C190 218 201 219 204 210C205 203 197 200 195 199"
            fill="#FFE7D9"
            stroke="#CFB3A4"
            strokeWidth="1.5"
          />
          </g><path
            d="M112 168L130 159H151L170 168L166 207L182 247Q140 264 98 247L114 206Z"
            fill="url(#dress)"
            stroke="#344951"
            strokeWidth="2"
          />
          <path
            d="M128 154V170Q140 182 152 170V153"
            fill="#FFE8DA"
            stroke="#D9BCA9"
            strokeWidth="1.5"
          />
          <path
            d="M125 164L139 179L118 184L111 170M154 163L139 179L162 183L171 170"
            fill="#FAF8FD"
          />
          <path
            d="M139 178L127 181L131 194L139 187L148 194L152 181Z"
            fill="#B7A6D8"
          />
          <circle cx="139" cy="183" r="3" fill="#EADBAD" />
          <path
            d="M117 207L111 244M132 210L129 250M147 211L149 250M162 208L170 245"
            stroke="#718181"
            strokeWidth="2"
          />
          <path d="M104 243Q139 256 176 244" stroke="#E8E3F0" strokeWidth="4" />
          <g className="girl-head">
            <path
              d="M79 106C72 58 94 26 140 25C186 26 209 61 199 112L193 154Q140 175 84 155Z"
              fill="url(#hair)"
              stroke="#8C7CAF"
              strokeWidth="2"
            />
            <path
              d="M88 94C88 140 103 158 139 165C175 158 192 140 191 94Q142 53 88 94Z"
              fill="#FFEBDD"
              stroke="#D9BCAE"
              strokeWidth="1.5"
            />
            <ellipse
              cx="94"
              cy="134"
              rx="11"
              ry="6"
              fill="#ECA9AB"
              opacity=".55"
            />
            <ellipse
              cx="183"
              cy="134"
              rx="11"
              ry="6"
              fill="#ECA9AB"
              opacity=".55"
            />
            <g className="blink-eyes">
              <ellipse cx="115" cy="119" rx="11" ry="16" fill="white" />
              <ellipse cx="165" cy="119" rx="11" ry="16" fill="white" />
              <ellipse cx="116" cy="121" rx="9" ry="13" fill="url(#eyes)" />
              <ellipse cx="164" cy="121" rx="9" ry="13" fill="url(#eyes)" />
              <ellipse cx="116" cy="120" rx="4" ry="8" fill="#51465D" />
              <ellipse cx="164" cy="120" rx="4" ry="8" fill="#51465D" />
              <circle cx="112" cy="115" r="4" fill="white" />
              <circle cx="160" cy="115" r="4" fill="white" />
              <circle cx="119" cy="127" r="2" fill="#EBE2FB" />
              <circle cx="167" cy="127" r="2" fill="#EBE2FB" />
              <path
                d="M103 108Q115 99 127 108M153 108Q166 100 176 108"
                stroke="#635572"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
            <path
              d="M134 144Q140 150 146 144"
              stroke="#B17979"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M82 106C73 64 104 35 139 36C182 36 203 67 197 108L181 92L174 66C168 86 151 99 130 102L143 73C128 95 107 100 98 100L103 76L89 110Z"
              fill="url(#hair)"
              stroke="#8C7CAF"
              strokeWidth="1.5"
            />
            <path
              d="M100 63Q113 45 132 44M151 46Q174 49 185 72"
              stroke="#E5DCF4"
              strokeWidth="4"
              strokeLinecap="round"
              opacity=".7"
            />
            <path
              d="M88 101Q81 129 95 159M190 100Q198 130 183 161"
              stroke="#B3A3D0"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <path
              d="M82 81L70 72L68 91L83 89L92 99L98 83Z"
              fill="#A3D8C2"
              stroke="#7EB29F"
              strokeWidth="1.5"
            />
            <circle cx="84" cy="86" r="4" fill="#F1D795" />
            <path
              d="M183 77L194 82M181 83L192 88"
              stroke="#E7D393"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </g>
        <g className="floating-sparkle" fill="#C6B7DF">
          <path d="M238 48L241 57L250 60L241 63L238 72L235 63L226 60L235 57Z" />
          <circle cx="46" cy="136" r="3" />
        </g>
        <Accessories accessory={accessory} pose={pose} />
      </svg>
    </button>
  );
}
