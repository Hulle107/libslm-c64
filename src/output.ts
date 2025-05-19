export type colorCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79 | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 92 | 93 | 94 | 95 | 96 | 97 | 98 | 99 | 100 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110 | 111 | 112 | 113 | 114 | 115 | 116 | 117 | 118 | 119 | 120 | 121 | 122 | 123 | 124 | 125 | 126 | 127 | 128 | 129 | 130 | 131 | 132 | 133 | 134 | 135 | 136 | 137 | 138 | 139 | 140 | 141 | 142 | 143 | 144 | 145 | 146 | 147 | 148 | 149 | 150 | 151 | 152 | 153 | 154 | 155 | 156 | 157 | 158 | 159 | 160 | 161 | 162 | 163 | 164 | 165 | 166 | 167 | 168 | 169 | 170 | 171 | 172 | 173 | 174 | 175 | 176 | 177 | 178 | 179 | 180 | 181 | 182 | 183 | 184 | 185 | 186 | 187 | 188 | 189 | 190 | 191 | 192 | 193 | 194 | 195 | 196 | 197 | 198 | 199 | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 209 | 210 | 211 | 212 | 213 | 214 | 215 | 216 | 217 | 218 | 219 | 220 | 221 | 222 | 223 | 224 | 225 | 226 | 227 | 228 | 229 | 230 | 231 | 232 | 233 | 234 | 235 | 236 | 237 | 238 | 239 | 240 | 241 | 242 | 243 | 244 | 245 | 246 | 247 | 248 | 249 | 250 | 251 | 252 | 253 | 254 | 255;

export enum Formatting {
    reset = '\x1b[0m',
    bold = '\x1b[1m',
    dim = '\x1b[2m',
    italic = '\x1b[3m',
    underlined = '\x1b[4m',
    blink = '\x1b[5m',
    inverted = '\x1b[6m',
    hidden = '\x1b[7m',
}

export enum ForegroundColor {
    default = '\x1b[39m',
    black = '\x1b[30m',
    red = '\x1b[31m',
    green = '\x1b[32m',
    yellow = '\x1b[33m',
    blue = '\x1b[34m',
    magenta = '\x1b[35m',
    cyan = '\x1b[36m',
    lightGray = '\x1b[37m',
    darkGray = '\x1b[90m',
    lightRed = '\x1b[91m',
    lightGreen = '\x1b[92m',
    lightYellow = '\x1b[93m',
    lightBlue = '\x1b[94m',
    lightMagenta = '\x1b[95m',
    lightCyan = '\x1b[96m',
    white = '\x1b[97m',
}

export enum BackgroundColor {
    default = '\x1b[49m',
    black = '\x1b[40m',
    red = '\x1b[41m',
    green = '\x1b[42m',
    yellow = '\x1b[43m',
    blue = '\x1b[44m',
    magenta = '\x1b[45m',
    cyan = '\x1b[46m',
    lightGray = '\x1b[47m',
    darkGray = '\x1b[100m',
    lightRed = '\x1b[101m',
    lightGreen = '\x1b[102m',
    lightYellow = '\x1b[103m',
    lightBlue = '\x1b[104m',
    lightMagenta = '\x1b[105m',
    lightCyan = '\x1b[106m',
    white = '\x1b[107m',
}

export const foregroundColor = (red: colorCode, green: colorCode, blue: colorCode): string => {
    return `\x1b[38;2;${red};${green};${blue}m`;
}

export const backgroundColor = (red: colorCode, green: colorCode, blue: colorCode): string => {
    return `\x1b[48;2;${red};${green};${blue}m`;
}

export const format = (...data: any[]): string => {
    data = data.map((value) => {
        if (typeof value === 'undefined') return ForegroundColor.red + value + ForegroundColor.default;
        if (value === null) return ForegroundColor.red + value + ForegroundColor.default;

        if (typeof value === 'bigint') return ForegroundColor.yellow + value + ForegroundColor.default;
        if (typeof value === 'number') return ForegroundColor.yellow + value + ForegroundColor.default;

        if (typeof value === 'object') return ForegroundColor.green + value + ForegroundColor.default;
        if (typeof value === 'function') return ForegroundColor.green + value + ForegroundColor.default;
        
        if (typeof value === 'boolean') return ForegroundColor.blue + value + ForegroundColor.default;
        return value;
    });
    
    return data.join(' ');
}