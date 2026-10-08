/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __nccwpck_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__nccwpck_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__nccwpck_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// ESM COMPAT FLAG
__nccwpck_require__.r(__webpack_exports__);

// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  runBoringBuildProvider: () => (/* binding */ runBoringBuildProvider)
});

;// CONCATENATED MODULE: external "crypto"
const external_crypto_namespaceObject = require("crypto");
;// CONCATENATED MODULE: external "process"
const external_process_namespaceObject = require("process");
;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/error.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function getLineColFromPtr(string, ptr) {
    let lines = string.slice(0, ptr).split(/\r?\n/);
    return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
    let lines = string.split(/\r?\n/);
    let codeblock = '';
    let numberLen = (Math.log10(line + 1) | 0) + 1;
    for (let i = line - 1; i <= line + 1; i++) {
        let l = lines[i - 1];
        if (!l)
            continue;
        codeblock += i.toString().padEnd(numberLen, ' ');
        codeblock += ':  ';
        codeblock += l;
        codeblock += '\n';
        if (i === line) {
            codeblock += ' '.repeat(numberLen + column + 2);
            codeblock += '^\n';
        }
    }
    return codeblock;
}
class TomlError extends Error {
    line;
    column;
    codeblock;
    constructor(message, options) {
        const [line, column] = getLineColFromPtr(options.toml, options.ptr);
        const codeblock = makeCodeBlock(options.toml, line, column);
        super(`Invalid TOML document: ${message}\n\n${codeblock}`, options);
        this.line = line;
        this.column = column;
        this.codeblock = codeblock;
    }
    /** @internal */
    static x(message, ctx, ptr) {
        throw new TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
    }
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/primitive.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/** @internal */
function parseString(ctx) {
    let startPtr = ctx.p;
    let c = ctx.s.charCodeAt(ctx.p++);
    let first = c;
    let isLiteral = c === 0x27; /* ' */
    let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
    if (isMultiline) {
        // Trim initial newline
        if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 0xa /* \n */)
            ctx.p++;
        else if (c === 0xd /* \r */ && ctx.s.charCodeAt(ctx.p + 1) === 0xa /* \n */)
            ctx.p += 2;
    }
    // For the record: it is not worth it to use a fast-path for literal strings using `indexOf`.
    // Doing a char-by-char iteration ends up dispatching less instructions, for the same wall-clock runtime.
    let parsed = '';
    let sliceStart = ctx.p;
    // states:
    //   0 - decoding
    //   1 - decoding escape
    //   2 - whitespace escape (no newline encountered yet, must fail on non-whitespace)
    //   3 - whitespace escape (newline encountered, allowed to transition back to normal decode)
    let state = 0;
    for (; ctx.p < ctx.s.length; ctx.p++) {
        c = ctx.s.charCodeAt(ctx.p);
        // Deal with newlines first, since that simplifies control character checking and handling across all states
        if (isMultiline && (c === 0xa /* \n */ || (c === 0xd /* \r */ && ctx.s.charCodeAt(ctx.p + 1) === 0xa /* \n */))) {
            state = state && 3;
        }
        // Control characters are banned in TOML, so we throw an error if we encounter them
        else if ((c < 0x20 && c !== 0x9 /* \t */) || c === 0x7f) {
            TomlError.x('control characters are not allowed in strings', ctx);
        }
        // The string might terminate while we're parsing through a newline escape.
        // It must have encountered a newline; otherwise, it'll simply fail in another branch.
        else if ((!state || state === 3) && c === first && (!isMultiline || (ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first))) {
            if (isMultiline) {
                // If the string ends with 4-5 quotes, then the first 1-2 are part of the string
                if (ctx.s.charCodeAt(ctx.p + 3) === first)
                    ctx.p++;
                if (ctx.s.charCodeAt(ctx.p + 3) === first)
                    ctx.p++;
            }
            // If we're in a newline escape still, then there's nothing to add.
            if (!state) {
                // Avoid a useless concat operation if the string can be used as-is.
                let s = ctx.s.slice(sliceStart, ctx.p);
                parsed = parsed ? parsed + s : s;
            }
            ctx.p += isMultiline ? 3 : 1;
            return parsed;
        }
        // Baseline state; keep moving forward unless an escape sequence starts
        else if (!state) {
            if (!isLiteral && c === 0x5c /* \ */) {
                parsed += ctx.s.slice(sliceStart, (sliceStart = ctx.p));
                state = 1;
            }
        }
        else if (state === 1) {
            if (c === 0x78 /* x */ || c === 0x75 /* u */ || c === 0x55 /* U */) { // Unicode escape
                let errPtr = ctx.p++ - 1;
                let value = 0;
                let len = c === 0x78 /* x */ ? 2 : c === 0x75 /* u */ ? 4 : 8;
                for (let j = 0; j < len; j++, ctx.p++) {
                    let hex = ctx.s.charCodeAt(ctx.p);
                    let digit = 
                    /* 0-9 */ hex >= 0x30 && hex <= 0x39 ? hex - 0x30 :
                        /* A-F */ hex >= 0x41 && hex <= 0x46 ? hex - 0x41 + 10 :
                            /* a-f */ hex >= 0x61 && hex <= 0x66 ? hex - 0x61 + 10 : -1;
                    if (digit < 0)
                        TomlError.x('invalid non-hex character in unicode escape', ctx);
                    value = (value << 4) | digit;
                }
                // Because JS does bitwise on signed 32bit integers, all 0xfzzzzzzz values are actually seen as negative
                if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
                    TomlError.x('invalid unicode escape', ctx, errPtr);
                }
                parsed += String.fromCodePoint(value);
                sliceStart = ctx.p--;
                state = 0;
            }
            // Newline escape sequence. We only need to care about spaces and tabs; newlines are dealt with earlier
            else if (isMultiline && (c === 0x20 || c === 0x9 /* \t */)) {
                state = 2;
            }
            // Basic escape sequence
            else {
                if (c === 0x62 /* b */)
                    parsed += '\b';
                else if (c === 0x74 /* t */)
                    parsed += '\t';
                else if (c === 0x6e /* n */)
                    parsed += '\n';
                else if (c === 0x66 /* f */)
                    parsed += '\f';
                else if (c === 0x72 /* r */)
                    parsed += '\r';
                else if (c === 0x65 /* e */)
                    parsed += '\x1b';
                else if (c === 0x22 /* " */)
                    parsed += '"';
                else if (c === 0x5c /* \ */)
                    parsed += '\\';
                else
                    TomlError.x('unrecognised escape sequence', ctx);
                sliceStart = ctx.p + 1;
                state = 0;
            }
        }
        // Newline escape continuation: keep moving forward until the first non-whitespace char
        else if (c !== 0x20 && c !== 0x9 /* \t */) {
            if (state === 2)
                TomlError.x('invalid escape: only line-ending whitespace may be escaped', ctx, sliceStart);
            // State cannot be zero, or we'd have branched earlier already.
            // If it's a backslash, immediately transition to the escape state so it can be processed.
            state = !isLiteral && c === 0x5c /* \ */ ? 1 : 0;
            sliceStart = ctx.p;
        }
    }
    TomlError.x('unfinished string', ctx, startPtr);
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/date.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
let DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
class TomlDate extends Date {
    #hasDate = false;
    #hasTime = false;
    #offset = null;
    constructor(date, fasttype, unsafeDelim) {
        let hasDate = true;
        let hasTime = true;
        let offset = 'Z';
        let c;
        if (typeof date === 'string') {
            if (fasttype)
                prep: {
                    // Date-time
                    if (fasttype < 3) {
                        if (+date.slice(11, 13) > 23) {
                            date = '';
                            break prep;
                        }
                        // Local
                        if (fasttype === 2) {
                            offset = null;
                            date += 'Z';
                        }
                        // Offset; keep track of offset if not Z
                        else if ((c = date.charCodeAt(date.length - 1)) !== 0x5a /* Z */ && c !== 0x7a /* z */) {
                            offset = date.slice(date.length - 6);
                        }
                        if (unsafeDelim)
                            date = date.slice(0, 10) + 'T' + date.slice(11);
                    }
                    // Time
                    else if (fasttype === 4) {
                        date = +date.slice(0, 2) > 23 ? '' : `0000-01-01T${date}Z`;
                    }
                    hasDate = fasttype !== 4;
                    hasTime = fasttype !== 3;
                }
            else {
                let match = date.match(DATE_TIME_RE);
                if (match) {
                    if (!match[1]) {
                        hasDate = false;
                        date = `0000-01-01T${date}`;
                    }
                    hasTime = !!match[2];
                    // Make sure to use T instead of a space. Breaks in case of extreme values otherwise.
                    hasTime && date[10] === ' ' && (date = date.replace(' ', 'T'));
                    // Do not allow rollover hours.
                    if (match[2] && +match[2] > 23) {
                        date = '';
                    }
                    else {
                        offset = match[3] || null;
                        if (!offset && hasTime)
                            date += 'Z';
                    }
                }
                else {
                    date = '';
                }
            }
        }
        super(date);
        if (!isNaN(this.getTime())) {
            this.#hasDate = hasDate;
            this.#hasTime = hasTime;
            this.#offset = offset;
        }
    }
    isDateTime() {
        return this.#hasDate && this.#hasTime;
    }
    isLocal() {
        return !this.#hasDate || !this.#hasTime || !this.#offset;
    }
    isDate() {
        return this.#hasDate && !this.#hasTime;
    }
    isTime() {
        return this.#hasTime && !this.#hasDate;
    }
    isValid() {
        return this.#hasDate || this.#hasTime;
    }
    toISOString() {
        let iso = super.toISOString();
        // Local Date
        if (this.isDate())
            return iso.slice(0, 10);
        // Local Time
        if (this.isTime())
            return iso.slice(11, 23);
        // Local DateTime
        if (this.#offset === null)
            return iso.slice(0, -1);
        // Offset DateTime
        if (this.#offset === 'Z' || this.#offset === 'z')
            return iso;
        // This part is quite annoying: JS strips the original timezone from the ISO string representation
        // Instead of using a "modified" date and "Z", we restore the representation "as authored"
        let offset = (+(this.#offset.slice(1, 3)) * 60) + +(this.#offset.slice(4, 6));
        offset = this.#offset[0] === '-' ? offset : -offset;
        let offsetDate = new Date(this.getTime() - (offset * 60e3));
        return offsetDate.toISOString().slice(0, -1) + this.#offset;
    }
    static wrapAsOffsetDateTime(jsDate, offset = 'Z') {
        let date = new TomlDate(jsDate);
        date.#offset = offset;
        return date;
    }
    static wrapAsLocalDateTime(jsDate) {
        let date = new TomlDate(jsDate);
        date.#offset = null;
        return date;
    }
    static wrapAsLocalDate(jsDate) {
        let date = new TomlDate(jsDate);
        date.#hasTime = false;
        date.#offset = null;
        return date;
    }
    static wrapAsLocalTime(jsDate) {
        let date = new TomlDate(jsDate);
        date.#hasDate = false;
        date.#offset = null;
        return date;
    }
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/extract.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */




function isDigit(char, base = 10) {
    return base === 16
        ? (char > 0x2f && char < 0x3a) || (char > 0x40 && char < 0x47) || (char > 0x60 && char < 0x67)
        : (char > 0x2f && char < 0x30 + base);
}
function isEndOfValue(char, delim) {
    // Whitespace -- we're permissive on `\r` for performance; it'll be dealt with later anyway
    return char === 0x20 || char === 0x9 /* \t */ || char === 0xa /* \n */ || char === 0xd /* \r */ ||
        // Structure end or next value delimiter
        (delim && (char === delim || char === 0x2c /* , */)) ||
        // Comment
        char === 0x23; /* # */
}
/** @internal */
function extractValue(ctx, end) {
    let errPtr = ctx.p;
    let c = ctx.s.charCodeAt(ctx.p);
    // Structs
    if (c === 0x5b /* [ */ || c === 0x7b /* { */) {
        ctx.d-- || TomlError.x('document contains excessively nested structures. aborting.', ctx);
        let value = c === 0x5b /* [ */
            ? parseArray(ctx)
            : parseInlineTable(ctx);
        ctx.d++;
        return value;
    }
    // Strings
    if (c === 0x22 /* " */ || c === 0x27 /* ' */) {
        return parseString(ctx);
    }
    // Booleans
    // We can fast-path because the first character is enough to know the only possible value
    if (c === 0x74 /* t */) { // Only possible valid value is `true`
        if (ctx.s.charCodeAt(++ctx.p) !== 0x72 || ctx.s.charCodeAt(++ctx.p) !== 0x75 || ctx.s.charCodeAt(++ctx.p) !== 0x65)
            TomlError.x('invalid value', ctx, errPtr);
        return ctx.p++, true;
    }
    if (c === 0x66 /* f */) { // Only possible valid value is `false`
        if (ctx.s.charCodeAt(++ctx.p) !== 0x61 || ctx.s.charCodeAt(++ctx.p) !== 0x6c || ctx.s.charCodeAt(++ctx.p) !== 0x73 || ctx.s.charCodeAt(++ctx.p) !== 0x65)
            TomlError.x('invalid value', ctx, errPtr);
        return ctx.p++, false;
    }
    if (c === 0x2b /* + */ || c === 0x2d /* - */) {
        return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 0x2c - c, end);
    }
    // Rough heuristic, but `parseDate` falls back to number parsing if it's a false positive.
    // e.g.: `a = 1\n-------------- = 1` would match this heuristic, but gracefully fallback to numbers.
    if (ctx.s.charCodeAt(ctx.p + 4) === 0x2d /* - */ && ctx.s.charCodeAt(ctx.p + 7) === 0x2d /* - */) {
        return parseDate(ctx, c, end);
    }
    // Same logic as above; `parseTime` falls back to number parsing if it's a false positive.
    if (ctx.s.charCodeAt(ctx.p + 2) === 0x3a /* : */) {
        return parseTime(ctx, c, end);
    }
    return parseNumber(ctx, ctx.p, c, 0, end);
}
// State:
// 0: init
// 1: integer
// 2: fractional dot
// 3: fractional
// 4: exponent letter
// 5: exponent
// >9: underscore; see below
//     -> 12: was integer
//     -> 14: was fractional
//     -> 16: was exponent
// states 2-5, 14, 16 are ONLY permitted iif base === 10
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
    let c = startChr;
    let state = 0;
    let hasUnderscores = false;
    // (+/-)inf
    if (c === 0x69 /* i */) {
        if (ctx.s.charCodeAt(++ctx.p) !== 0x6e || ctx.s.charCodeAt(++ctx.p) !== 0x66)
            TomlError.x('invalid value', ctx, startPtr);
        return ctx.p++, (sign || 1) / 0;
    }
    // (+/-)nan
    if (c === 0x6e /* n */) {
        if (ctx.s.charCodeAt(++ctx.p) !== 0x61 || ctx.s.charCodeAt(++ctx.p) !== 0x6e)
            TomlError.x('invalid value', ctx, startPtr);
        return ctx.p++, NaN;
    }
    // Leading zero
    // Only allowed cases: `0<EOV>`, `0.(...)`, `0e(...)`, `0x(...)`, `0b(...)`, `0o(...)`
    // FWIW, `0e(...)` is a stupid case, but it's not banned per-se so we have to parse it
    if (c === 0x30 /* 0 */) {
        if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
            return ctx.bi === true ? 0n : 0; // note: conveniently deals with `-0`
        if (!sign) {
            if (c === 0x78 /* x */)
                return parseIntegerBaseN(ctx, startPtr, 16, endChr);
            else if (c === 0x62 /* b */)
                return parseIntegerBaseN(ctx, startPtr, 2, endChr);
            else if (c === 0x6f /* o */)
                return parseIntegerBaseN(ctx, startPtr, 8, endChr);
        }
        if (c === 0x2e /* . */)
            state = 2;
        else if (c === 0x65 /* e */ || c === 0x45 /* E */)
            state = 4;
        else
            TomlError.x('illegal leading zero', ctx, startPtr);
    }
    // If the 1st char is not a digit by now, then it's not a valid TOML value at all
    else if (!isDigit(c))
        TomlError.x('invalid value', ctx, startPtr);
    while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
        if (!state)
            state = 1; // Detects single-digit numbers we can use a fast parse path for
        // The way the states are numbered is not random: underscores are always permitted in odd-numbered states and
        // never permitted in even-numbered ones.
        if (c === 0x5f /* _ */) {
            if (!(state & 1))
                TomlError.x('illegal underscore', ctx);
            state += 11; // 11 is a marker that makes the state even and greater than 9; see the numbering + rationale above
            hasUnderscores = true;
        }
        // Transition to fractional part.
        else if (state === 1 && c === 0x2e /* . */)
            state = 2;
        // Transition to exponent part.
        else if ((state === 1 || state === 3) && (c === 0x65 /* e */ || c === 0x45 /* E */))
            state = 4;
        // + and - are permitted in state 4 only (handled before entering the function for state 0)
        else if (state === 4 && (c === 0x2b /* + */ || c === 0x2d /* - */)) { /* no-op */ }
        // All special cases have been handled; only digits are allowed here
        else if (!isDigit(c))
            TomlError.x(`illegal character in numeric literal`, ctx);
        // Clear state flags
        else if (state > 9)
            state -= 11;
        else if (!(state & 1))
            state++;
    }
    // Single-char number; we can fast-path these very easily.
    if (!state) {
        let val = (startChr - 0x30 /* 0 */) * (sign || 1);
        return ctx.bi === true ? BigInt(val) : val;
    }
    // Even-numbered states absolutely require a digit next; not even end of value is permitted
    if (!(state & 1))
        TomlError.x('unfinished numeric value', ctx, startPtr);
    let str = ctx.s.slice(startPtr, ctx.p);
    if (hasUnderscores)
        str = str.replaceAll('_', ''); // perf: replaceAll 1.25x faster than replace with a regex
    return state > 1
        ? parseFloat(str)
        : parseInteger(ctx, str, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
    let c, underscore = 1;
    while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
        if (c === 0x5f /* _ */) {
            if (underscore & 1)
                TomlError.x('illegal underscore', ctx);
            underscore = 3;
        }
        // We only need to check if the number is a valid digit, nothing else is permitted
        else if (!isDigit(c, base))
            TomlError.x(`illegal character in numeric literal`, ctx);
        // Clear underscore flag
        else if (underscore & 1)
            underscore--;
    }
    // Trailing underscore is not allowed
    if (underscore & 1)
        TomlError.x('unfinished numeric value', ctx);
    let str = ctx.s.slice(startPtr + 2, ctx.p);
    if (underscore)
        str = str.replaceAll('_', ''); // perf: replaceAll 1.25x faster than replace with a regex
    return parseInteger(ctx, str, base, startPtr);
}
function parseInteger(ctx, str, base, startPtr) {
    if (ctx.bi !== true)
        int: {
            let val = parseInt(str, base);
            if (!Number.isSafeInteger(val)) {
                if (ctx.bi)
                    break int;
                TomlError.x('integer value cannot be represented losslessly', ctx, startPtr);
            }
            return val;
        }
    return base === 10 ? BigInt(str) : BigInt((base === 2 ? '0b' : base === 8 ? '0o' : '0x') + str);
}
function parseDate(ctx, c, endChr) {
    let startPtr = ctx.p++, unsafeSeparator;
    if (!isDigit(c) ||
        !isDigit(ctx.s.charCodeAt(ctx.p++)) ||
        !isDigit(ctx.s.charCodeAt(ctx.p++)) ||
        !isDigit(ctx.s.charCodeAt(ctx.p++))) {
        return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
    }
    ctx.p += 5;
    if (!isDigit(ctx.s.charCodeAt(ctx.p++)))
        TomlError.x('invalid date-time: date part is malformed', ctx, startPtr);
    if (ctx.p >= ctx.s.length || (((c = ctx.s.charCodeAt(ctx.p)) !== 0x20 || (unsafeSeparator = true, !isDigit(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 0x54 /* T */ && c !== 0x74 /* t */)) {
        let t = ctx.s.slice(startPtr, ctx.p);
        return readDate(ctx, t, 3, false, startPtr);
    }
    if (ctx.s.charCodeAt(ctx.p += 3) !== 0x3a /* : */)
        TomlError.x('invalid date-time: time part is malformed', ctx, startPtr);
    if (ctx.s.charCodeAt(ctx.p += 3) === 0x3a /* : */)
        ctx.p += 3;
    if (ctx.s.charCodeAt(ctx.p) === 0x2e /* . */)
        while (isDigit(ctx.s.charCodeAt(++ctx.p)))
            ;
    if (c = ctx.s.charCodeAt(ctx.p)) {
        if (c === 0x5a /* Z */ || c === 0x7a /* z */) {
            let t = ctx.s.slice(startPtr, ++ctx.p);
            return readDate(ctx, t, 1, unsafeSeparator, startPtr, '[+00:00]');
        }
        if (c === 0x2b /* + */ || c === 0x2d /* - */) {
            // Temporal's ZonedDateTime is weird asf when it comes to dealing with traditional offsets...
            // It's 1.2x faster to allocate a new string to pass to ZDT than use Instant.toZonedDateTimeISO
            let t = ctx.s.slice(startPtr, ctx.p += 6);
            return readDate(ctx, t, 1, unsafeSeparator, startPtr, !ctx.ld && ('[' + ctx.s.slice(ctx.p - 6, ctx.p) + ']'));
        }
    }
    let t = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
    let start = ctx.p;
    if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
        return parseNumber(ctx, --ctx.p, c, 0, endChr);
    }
    if (ctx.s.charCodeAt(ctx.p += 4) === 0x3a /* : */)
        ctx.p += 3;
    if (ctx.s.charCodeAt(ctx.p) === 0x2e /* . */)
        while (isDigit(ctx.s.charCodeAt(++ctx.p)))
            ;
    let t = ctx.s.slice(start, ctx.p);
    return readDate(ctx, t, 4, false, start);
}
function readDate(ctx, str, type, unsafeDelim, errPtr, temporalSuffix) {
    if (ctx.ld) {
        let date = new TomlDate(str, type, unsafeDelim);
        if (!date.isValid())
            TomlError.x('invalid date', ctx, errPtr);
        return date;
    }
    try {
        if (temporalSuffix)
            str += temporalSuffix;
        switch (type) {
            case 1: return Temporal.ZonedDateTime.from(str);
            case 2: return Temporal.PlainDateTime.from(str);
            case 3: return Temporal.PlainDate.from(str);
            case 4: return Temporal.PlainTime.from(str);
        }
    }
    catch (e) {
        TomlError.x(e instanceof Error ? e.message : '' + e, ctx, errPtr);
    }
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/util.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/** @internal */
function skipComment(ctx) {
    for (; ctx.p < ctx.s.length; ctx.p++) {
        let c = ctx.s.charCodeAt(ctx.p);
        if (c === 0xa /* \n */)
            break;
        if (c === 0xd /* \r */ && ctx.s.charCodeAt(ctx.p + 1) === 0xa /* \n */) {
            ctx.p++;
            break;
        }
        if ((c < 0x20 && c !== 0x9 /* \t */) || c === 0x7f) {
            TomlError.x('control characters are not allowed in comments', ctx);
        }
    }
}
/** @internal */
function skipVoid(ctx, banNewLines, banComments) {
    let c;
    while (ctx.p < ctx.s.length) {
        while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 0x20 ||
            c === 0x9 /* \t */ ||
            (!banNewLines &&
                (c === 0xa /* \n */ || (c === 0xd /* \r */ && ctx.s.charCodeAt(ctx.p + 1) === 0xa /* \n */)))))
            ctx.p++;
        if (banComments || c !== 0x23 /* # */)
            break;
        skipComment(ctx);
    }
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/struct.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */




/** @internal */
function parseKey(ctx, end = 0x3d /* = */) {
    // States:
    // 0: before first char
    // 1: parsing bare key
    // 2: after key component
    let startPtr;
    let state = 0;
    let parsed = [];
    let sliceStart;
    let c = ctx.s.charCodeAt(startPtr = ctx.p);
    do {
        // End of key
        if (c === end) {
            if (!state)
                TomlError.x('unexpected end of key', ctx);
            if (state === 1)
                parsed.push(ctx.s.slice(sliceStart, ctx.p));
            return ctx.p++, parsed;
        }
        // Dotted key separator
        else if (c === 0x2e /* . */) {
            if (!state)
                TomlError.x('illegal empty bare key', ctx);
            if (state === 1)
                parsed.push(ctx.s.slice(sliceStart, ctx.p));
            state = 0;
        }
        // Quoted key
        else if (!state && (c === 0x22 /* " */ || c === 0x27 /* ' */)) {
            if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
                TomlError.x('illegal quoted key: multiline strings are not allowed', ctx);
            parsed.push(parseString(ctx));
            state = 2;
            ctx.p--;
        }
        // Whitespace; no-op in state 0 and 2, end of bare key in state 1
        else if (c === 0x20 || c === 0x9 /* \t */) {
            if (state === 1) {
                parsed.push(ctx.s.slice(sliceStart, ctx.p));
                state = 2;
            }
        }
        // If state is post-key, no character is allowed; otherwise ensure it's a bare-key component
        else if (state === 2 || (c < 0x30 && c !== 0x2d /* - */) || (c > 0x39 && c < 0x41) || (c > 0x5a && c < 0x61 && c !== 0x5f /* _ */) || c > 0x7a) {
            TomlError.x('illegal character in key', ctx);
        }
        // Illegal character
        else if (!state) {
            state = 1;
            sliceStart = ctx.p;
        }
    } while (c = ctx.s.charCodeAt(++ctx.p));
    TomlError.x('incomplete key-value: cannot find end of key', ctx, startPtr);
}
/** @internal */
function parseInlineTable(ctx) {
    let startPtr = ctx.p++;
    let res = Object.create(null);
    let seen = new Set();
    let c;
    while (ctx.p < ctx.s.length) {
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p)) === 0x7d /* } */) {
            ctx.p++;
            return res;
        }
        let k;
        let t = res;
        let hasOwn = false;
        let errPtr = ctx.p;
        let key = parseKey(ctx);
        for (let i = 0; i < key.length; i++) {
            if (i)
                t = hasOwn ? t[k] : (t[k] = Object.create(null));
            k = key[i];
            if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== 'object' || seen.has(t[k]))) {
                TomlError.x('trying to redefine an already defined value', ctx, errPtr);
            }
            let unsafe = k === '__proto__';
            if (ctx.uk && (unsafe || k === 'constructor')) {
                t = ctx.uk !== 1 && TomlError.x('document contains an unsafe property', ctx, errPtr);
                break;
            }
            if (!hasOwn && unsafe) {
                Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
            }
        }
        if (hasOwn) {
            TomlError.x('trying to redefine an already defined value', ctx, errPtr);
        }
        skipVoid(ctx, true, true);
        let value = extractValue(ctx, 0x7d /* } */);
        if (t && typeof (t[k] = value) === 'object')
            seen.add(value);
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p++)) === 0x7d /* } */) {
            return res;
        }
        if (c !== 0x2c /* , */)
            TomlError.x('expected comma or end of structure', ctx, ctx.p - 1);
    }
    TomlError.x('unfinished table', ctx, startPtr);
}
/** @internal */
function parseArray(ctx) {
    let startPtr = ctx.p++;
    let res = [];
    let c;
    while (ctx.p < ctx.s.length) {
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p)) === 0x5d /* ] */) {
            ctx.p++;
            return res;
        }
        res.push(extractValue(ctx, 0x5d /* ] */));
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p++)) === 0x5d /* ] */) {
            return res;
        }
        if (c !== 0x2c /* , */)
            TomlError.x('expected comma or end of structure', ctx, ctx.p - 1);
    }
    TomlError.x('unfinished array', ctx, startPtr);
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/parse.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */




function peekTable(ctx, key, table, meta, type) {
    let t = table;
    let m = meta;
    let k;
    let hasOwn = false;
    let state;
    for (let i = 0; i < key.length; i++) {
        if (i) {
            t = hasOwn ? t[k] : (t[k] = Object.create(null));
            m = (state = m[k]).c;
            if (type === 0 /* Type.DOTTED */ && (state.t === 1 /* Type.EXPLICIT */ || state.t === 2 /* Type.ARRAY */)) {
                return null;
            }
            if (state.t === 2 /* Type.ARRAY */) {
                let l = t.length - 1;
                t = t[l];
                m = m[l].c;
            }
        }
        k = key[i];
        if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 /* Type.DOTTED */ && m[k]?.d) {
            return null;
        }
        if (!hasOwn) {
            let unsafe = k === '__proto__';
            if (ctx.uk && (unsafe || k === 'constructor'))
                return false;
            if (unsafe) {
                Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
                Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
            }
            m[k] = {
                t: i < key.length - 1 && type === 2 /* Type.ARRAY */
                    ? 3 /* Type.ARRAY_DOTTED */ : type,
                d: false,
                i: 0,
                c: Object.create(null),
            };
        }
    }
    state = m[k];
    if (state.t !== type && !(type === 1 /* Type.EXPLICIT */ && state.t === 3 /* Type.ARRAY_DOTTED */)) {
        // Bad key type!
        return null;
    }
    if (type === 2 /* Type.ARRAY */) {
        if (!state.d) {
            state.d = true;
            t[k] = [];
        }
        t[k].push(t = Object.create(null));
        state.c[state.i++] = (state = { t: 1 /* Type.EXPLICIT */, d: false, i: 0, c: Object.create(null) });
    }
    if (state.d) {
        // Redefining a table!
        return null;
    }
    state.d = true;
    if (type === 1 /* Type.EXPLICIT */) {
        t = hasOwn ? t[k] : (t[k] = Object.create(null));
    }
    else if (type === 0 /* Type.DOTTED */ && hasOwn) {
        return null;
    }
    return [k, t, state.c];
}
function validateTablePeek(ctx, peek, ptr) {
    if (peek === null || ctx.uk === 2)
        TomlError.x(peek === null
            ? 'trying to redefine an already defined table or value'
            : 'document contains an unsafe property', ctx, ptr);
}
function parse(toml, options = {}) {
    let ctx = {
        s: toml,
        p: 0,
        d: options.maxDepth ?? 1000,
        bi: options.integersAsBigInt ?? false,
        ld: options.useLegacyDate ?? true,
        uk: options.unsafeKeyBehaviour === 'throw' ? 2 : options.unsafeKeyBehaviour === 'drop' ? 1 : 0,
    };
    let res = Object.create(null);
    let meta = Object.create(null);
    let tmp;
    let skipping = false;
    let tbl = res;
    let m = meta;
    // BOM is allowed, skip.
    // JS is UTF-16, so we have to check for the UTF-16 BOM instead of the UTF-8 BOM sequence!
    if (toml.charCodeAt(0) === 0xfeff)
        ctx.p++;
    skipVoid(ctx);
    while (ctx.p < toml.length) {
        if (toml.charCodeAt(ctx.p) === 0x5b /* [ */) {
            let isTableArray = toml.charCodeAt(++ctx.p) === 0x5b; /* [ */
            tmp = ctx.p += +isTableArray;
            skipping = false;
            let k = parseKey(ctx, 0x5d /* ] */);
            if (isTableArray) {
                if (toml.charCodeAt(ctx.p) !== 0x5d /* ] */) {
                    TomlError.x('expected end of table array declaration', ctx);
                }
                ctx.p++;
            }
            let p = peekTable(ctx, k, res, meta, isTableArray ? 2 /* Type.ARRAY */ : 1 /* Type.EXPLICIT */);
            if (!p) {
                validateTablePeek(ctx, p, tmp);
                skipping = true;
            }
            else {
                m = p[2];
                tbl = p[1];
            }
        }
        else {
            tmp = ctx.p;
            let k = parseKey(ctx);
            let p = peekTable(ctx, k, tbl, m, 0 /* Type.DOTTED */);
            if (!p && !skipping)
                validateTablePeek(ctx, p, tmp);
            skipVoid(ctx, true, true);
            let v = extractValue(ctx, void 0);
            if (p && !skipping)
                p[1][p[0]] = v;
        }
        skipVoid(ctx, true);
        if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 0xa /* \n */ && (tmp !== 0xd /* \r */ || toml.charCodeAt(ctx.p + 1) !== 0xa /* \n */)) {
            TomlError.x('each key-value declaration must be followed by an end-of-line', ctx);
        }
        skipVoid(ctx);
    }
    return res;
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/stringify.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
let BARE_KEY = /^[a-z0-9-_]+$/i;
let HAS_WELLFORMED = !!(''.isWellFormed);
function extendedTypeOf(obj) {
    let type = typeof obj;
    if (type === 'object') {
        if (Array.isArray(obj))
            return 'array';
        if (typeof obj.getUTCDate === 'function' && obj instanceof Date)
            return 'date';
        if (globalThis.Temporal) {
            if (obj.until) {
                if (obj instanceof Temporal.ZonedDateTime)
                    return 'temporal/tz+uc';
                if (obj instanceof Temporal.PlainDateTime || obj instanceof Temporal.PlainDate)
                    return 'temporal/uc';
                if (obj instanceof Temporal.PlainTime || obj instanceof Temporal.Instant)
                    return 'temporal';
                if (obj instanceof Temporal.PlainYearMonth)
                    return 'temporal/x';
            }
            else if ((obj.toPlainDate && obj instanceof Temporal.PlainMonthDay) ||
                (obj.negated && obj instanceof Temporal.Duration)) {
                return 'temporal/x';
            }
        }
    }
    return type;
}
function isArrayOfTables(obj) {
    for (let i = 0; i < obj.length; i++) {
        if (extendedTypeOf(obj[i]) !== 'object')
            return false;
    }
    return obj.length != 0;
}
function formatWellFormedStringUnchecked(s) {
    return JSON.stringify(s).replaceAll('\x7f', '\\u007f');
}
function formatString(s) {
    return formatWellFormedStringUnchecked(HAS_WELLFORMED ? s.toWellFormed() : s);
}
function formatKey(s) {
    if (BARE_KEY.test(s))
        return s;
    if (HAS_WELLFORMED && !s.isWellFormed())
        throw new RangeError('key contains illegal lone surrogates');
    return formatWellFormedStringUnchecked(s);
}
function stringifyValue(val, type, depth, numberAsFloat, strictTemporal) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    switch (type) {
        // @ts-expect-error -- intentional fallthrough case
        case 'number':
            if (isNaN(val))
                return 'nan';
            if (val === Infinity)
                return 'inf';
            if (val === -Infinity)
                return '-inf';
            if (Number.isInteger(val) && (numberAsFloat || !Number.isSafeInteger(val)))
                return val.toFixed(1);
        case 'bigint':
        case 'boolean':
        case 'temporal':
            return val.toString();
        case 'string':
            return formatString(val);
        case 'date':
            if (isNaN(val.getTime()))
                throw new TypeError('cannot serialize invalid date');
            return val.toISOString();
        case 'object':
            return stringifyInlineTable(val, depth, numberAsFloat, strictTemporal);
        case 'array':
            return stringifyArray(val, depth, numberAsFloat, strictTemporal);
        // @ts-expect-error -- intentional fallthrough case
        case 'temporal/tz+uc':
            if (strictTemporal) {
                let tz = val.timeZoneId;
                let tzc = tz.charCodeAt(0);
                if (
                // Classic offset
                tzc !== 0x2b /* + */ && tzc !== 0x2d /* - */ &&
                    (
                    // Fast pre-check pass; see below for the actually accepted values
                    (tzc !== 0x55 /* U */ && tzc !== 0x47 /* G */ && tzc !== 0x5a /* Z */ && tzc !== 0x45 /* E */) ||
                        (
                        // UTC and its aliases; Temporal implementations don't all canonicalise unfortunately
                        tz !== 'UTC' && tz !== 'UCT' && tz !== 'Universal' && tz !== 'Zulu' &&
                            // GMT is a TZ but it's for all intents and purposes equivalent to UTC. Safe to downgrade.
                            !tz.startsWith('GMT') && tz !== 'Greenwich' &&
                            // Etc/* are all safe to downgrade to offset (either UTC, GMT, or offset)
                            !tz.startsWith('Etc/')))) {
                    throw new TypeError('Temporal objects with an IANA timezone are not allowed in Temporal strict mode');
                }
            }
        case 'temporal/uc':
            if (strictTemporal && val.calendarId !== 'iso8601')
                throw new TypeError('Temporal objects with a non-default calendar are not allowed in Temporal strict mode');
            return val.toString({
                calendarName: 'never',
                timeZoneName: 'never',
            });
        case 'temporal/x':
            throw new TypeError('Unsupported ' + val[Symbol.toStringTag]);
    }
}
function stringifyInlineTable(obj, depth, numberAsFloat, strictTemporal) {
    let keys = Object.keys(obj);
    if (keys.length === 0)
        return '{}';
    let res = '{ ';
    for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        if (i)
            res += ', ';
        res += formatKey(k) + ' = ' + stringifyValue(obj[k], extendedTypeOf(obj[k]), depth - 1, numberAsFloat, strictTemporal);
    }
    return res + ' }';
}
function stringifyArray(array, depth, numberAsFloat, strictTemporal) {
    if (array.length === 0)
        return '[]';
    let res = '[ ';
    for (let i = 0; i < array.length; i++) {
        if (i)
            res += ', ';
        if (array[i] === null || array[i] === void 0) {
            throw new TypeError('arrays cannot contain null or undefined values');
        }
        res += stringifyValue(array[i], extendedTypeOf(array[i]), depth - 1, numberAsFloat, strictTemporal);
    }
    return res + ' ]';
}
function stringifyArrayTable(array, key, depth, numberAsFloat, strictTemporal) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    let res = '';
    for (let i = 0; i < array.length; i++) {
        res += `${res && '\n'}[[${key}]]\n`;
        res += stringifyTable(0, array[i], key, depth, numberAsFloat, strictTemporal);
    }
    return res;
}
function stringifyTable(tableKey, obj, prefix, depth, numberAsFloat, strictTemporal) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    let preamble = '';
    let tables = '';
    let keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        if (obj[k] !== null && obj[k] !== void 0) {
            let type = extendedTypeOf(obj[k]);
            if (type === 'symbol' || type === 'function') {
                throw new TypeError(`cannot serialize values of type '${type}'`);
            }
            let key = formatKey(k);
            if (type === 'array' && isArrayOfTables(obj[k])) {
                tables += (tables && '\n') + stringifyArrayTable(obj[k], prefix ? `${prefix}.${key}` : key, depth - 1, numberAsFloat, strictTemporal);
            }
            else if (type === 'object') {
                let tblKey = prefix ? `${prefix}.${key}` : key;
                tables += (tables && '\n') + stringifyTable(tblKey, obj[k], tblKey, depth - 1, numberAsFloat, strictTemporal);
            }
            else {
                preamble += key;
                preamble += ' = ';
                preamble += stringifyValue(obj[k], type, depth, numberAsFloat, strictTemporal);
                preamble += '\n';
            }
        }
    }
    if (tableKey && (preamble || !tables)) // Create table only if necessary
        preamble = preamble ? `[${tableKey}]\n${preamble}` : `[${tableKey}]`;
    return preamble && tables
        ? `${preamble}\n${tables}`
        : preamble || tables;
}
function stringify(obj, { maxDepth = 1000, numbersAsFloat = false, strictTemporal = false } = {}) {
    if (extendedTypeOf(obj) !== 'object') {
        throw new TypeError('stringify can only be called with an object');
    }
    let str = stringifyTable(0, obj, '', maxDepth, numbersAsFloat, strictTemporal);
    if (str[str.length - 1] !== '\n')
        return str + '\n';
    return str;
}

;// CONCATENATED MODULE: ./node_modules/smol-toml/dist/index.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */





/** @deprecated use `import * as ... from 'smol-toml'` instead */
/* harmony default export */ const dist = ({ parse: parse, stringify: stringify, TomlDate: TomlDate, TomlError: TomlError });

;// CONCATENATED MODULE: external "timers/promises"
const promises_namespaceObject = require("timers/promises");
;// CONCATENATED MODULE: ./dist/trust-provider-oidc.js

const MAX_OIDC_RESPONSE_BYTES = (/* unused pure expression or super */ null && (32 * 1024));
const OIDC_REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 250;
const MAX_BACKOFF_MS = 4_000;
const MAX_RETRY_AFTER_MS = 15_000;
class TransientOidcFailure extends Error {
    retryAfterMs;
    constructor(message, retryAfterMs) {
        super(message);
        this.retryAfterMs = retryAfterMs;
    }
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function retryableStatus(status) {
    return status === 408 || status === 429 || (status >= 500 && status !== 507);
}
function retryAfterMs(headers) {
    const value = headers.get('retry-after')?.trim();
    if (!value)
        return undefined;
    if (/^\d+$/.test(value))
        return Number(value) * 1000;
    const deadline = Date.parse(value);
    return Number.isNaN(deadline) ? undefined : Math.max(0, deadline - Date.now());
}
function oidcRetryDelayMs(attempt, retryAfter) {
    if (attempt >= MAX_ATTEMPTS)
        return undefined;
    const backoff = Math.min(BASE_DELAY_MS * 2 ** Math.min(attempt - 1, 4), MAX_BACKOFF_MS);
    return retryAfter === undefined ? backoff : Math.max(backoff, Math.min(retryAfter, MAX_RETRY_AFTER_MS));
}
async function requestIdentityTokenOnce(url, requestToken, provider, maxBytes) {
    let response;
    try {
        response = await fetch(url, {
            headers: { authorization: `Bearer ${requestToken}` },
            redirect: 'error',
            signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS),
        });
    }
    catch (error) {
        throw new TransientOidcFailure(`${provider} OIDC request failed: ${errorMessage(error)}`);
    }
    if (!response.ok || !response.body) {
        const message = `${provider} OIDC request failed with HTTP ${response.status}`;
        if (retryableStatus(response.status)) {
            throw new TransientOidcFailure(message, retryAfterMs(response.headers));
        }
        throw new Error(message);
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
        throw new Error(`${provider} OIDC response is too large`);
    }
    const chunks = [];
    let size = 0;
    try {
        for await (const chunk of response.body) {
            const bytes = Buffer.from(chunk);
            size += bytes.byteLength;
            if (size > maxBytes)
                break;
            chunks.push(bytes);
        }
    }
    catch (error) {
        throw new TransientOidcFailure(`Failed to read the ${provider} OIDC response: ${errorMessage(error)}`);
    }
    if (size > maxBytes)
        throw new Error(`${provider} OIDC response is too large`);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(payload) || typeof payload.value !== 'string'
        || payload.value.length > maxBytes || /\s/.test(payload.value)) {
        throw new Error(`${provider} OIDC response is invalid`);
    }
    return payload.value;
}
async function requestIdentityToken(url, requestToken, provider, maxBytes) {
    for (let attempt = 1;; attempt += 1) {
        try {
            return await requestIdentityTokenOnce(url, requestToken, provider, maxBytes);
        }
        catch (error) {
            if (!(error instanceof TransientOidcFailure))
                throw error;
            const wait = oidcRetryDelayMs(attempt, error.retryAfterMs);
            if (wait === undefined) {
                throw new Error(`${provider} OIDC request failed after ${attempt} attempts: ${error.message}`);
            }
            process.stderr.write(`${provider} OIDC request attempt ${attempt} of ${MAX_ATTEMPTS} failed: ${error.message}; retrying in ${(wait / 1000).toFixed(2)}s\n`);
            await (0,promises_namespaceObject.setTimeout)(wait);
        }
    }
}
async function githubIdentityToken() {
    const requestURL = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!requestURL || !requestToken) {
        throw new Error('GitHub OIDC request capability is required for attest');
    }
    const url = new URL(requestURL);
    const trustedHost = url.hostname === 'actions.githubusercontent.com'
        || url.hostname.endsWith('.actions.githubusercontent.com');
    if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443') || !trustedHost
        || url.username || url.password || url.hash || url.searchParams.getAll('audience').length !== 1
        || url.searchParams.get('audience') !== 'sigstore') {
        throw new Error('GitHub OIDC request URL is invalid');
    }
    if (requestToken.trim() !== requestToken || /[^\x21-\x7e]/.test(requestToken)
        || requestToken.length > 32 * 1024) {
        throw new Error('GitHub OIDC request credential is invalid');
    }
    try {
        return await requestIdentityToken(url, requestToken, 'GitHub', MAX_OIDC_RESPONSE_BYTES);
    }
    finally {
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    }
}

;// CONCATENATED MODULE: ./dist/boringbuild-trust-provider.js




const PROTOCOL_VERSION = 1;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_BUNDLE_BYTES = 256 * 1024;
const MAX_TOKEN_BYTES = 64 * 1024;
const MEDIA_TYPE = 'application/vnd.boringbuild.publisher-oidc+jwt';
function boringbuild_trust_provider_isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function subjectAudience(subject) {
    return `urn:boringcache:publisher:v1:${subject.kind}:sha256:${subject.digest.sha256}`;
}
function subjectDigest(subject) {
    return `sha256:${subject.digest.sha256}`;
}
function assertRequest(value) {
    if (!boringbuild_trust_provider_isObject(value) || value.protocol_version !== PROTOCOL_VERSION
        || typeof value.request_id !== 'string' || !/^[0-9a-f-]{36}$/.test(value.request_id)
        || !boringbuild_trust_provider_isObject(value.subject) || ![
        'archive', 'archive-graph', 'oci', 'gha-cache', 'kv-batch', 'artifact', 'registry',
    ].includes(String(value.subject.kind))
        || !boringbuild_trust_provider_isObject(value.subject.digest)
        || !/^[0-9a-f]{64}$/.test(String(value.subject.digest.sha256))) {
        throw new Error('publisher request is invalid');
    }
}
function decodeBase64(value, field, limit) {
    if (typeof value !== 'string' || value.length > Math.ceil(limit / 3) * 4 + 4) {
        throw new Error(`${field} is too large`);
    }
    const bytes = Buffer.from(value, 'base64');
    if (bytes.byteLength > limit || bytes.toString('base64') !== value) {
        throw new Error(`${field} is not canonical bounded base64`);
    }
    return bytes;
}
function decodeBase64Url(value, field, limit) {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > Math.ceil(limit / 3) * 4 + 4) {
        throw new Error(`${field} is invalid`);
    }
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.byteLength > limit || bytes.toString('base64url') !== value) {
        throw new Error(`${field} is invalid`);
    }
    return bytes;
}
function exactRequestURL(value, audience) {
    const url = new URL(value);
    const query = [...url.searchParams.entries()];
    if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')
        || url.username || url.password || url.hash
        || !/^\/_boringbuild\/oidc\/token\/[^/]+$/.test(url.pathname)
        || query.length !== 2 || query[0][0] !== 'api-version' || query[0][1] !== '1'
        || query[1][0] !== 'audience' || query[1][1] !== audience) {
        throw new Error('BoringBuild OIDC request URL is invalid');
    }
    return url;
}
async function identityToken(subject) {
    const requestURL = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!requestURL || !requestToken)
        throw new Error('BoringBuild OIDC request capability is required');
    const url = exactRequestURL(requestURL, subjectAudience(subject));
    if (requestToken.trim() !== requestToken || /[^\x21-\x7e]/.test(requestToken)
        || requestToken.length > 32 * 1024) {
        throw new Error('BoringBuild OIDC request credential is invalid');
    }
    try {
        return await requestIdentityToken(url, requestToken, 'BoringBuild', MAX_TOKEN_BYTES);
    }
    finally {
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    }
}
function parseToken(token) {
    if (Buffer.byteLength(token) > MAX_TOKEN_BYTES)
        throw new Error('OIDC token is too large');
    const parts = token.split('.');
    if (parts.length !== 3)
        throw new Error('OIDC token is invalid');
    const header = JSON.parse(decodeBase64Url(parts[0], 'OIDC header', 2048).toString('utf8'));
    const claims = JSON.parse(decodeBase64Url(parts[1], 'OIDC claims', 32 * 1024).toString('utf8'));
    if (!boringbuild_trust_provider_isObject(header) || !boringbuild_trust_provider_isObject(claims) || header.alg !== 'RS256' || header.typ !== 'JWT'
        || typeof header.kid !== 'string') {
        throw new Error('OIDC token header or claims are invalid');
    }
    return {
        header, claims, signed: `${parts[0]}.${parts[1]}`,
        signature: decodeBase64Url(parts[2], 'OIDC signature', 1024),
    };
}
function pinnedKey(publisher) {
    const key = publisher['public-key'];
    if (!boringbuild_trust_provider_isObject(key) || typeof key.kid !== 'string'
        || typeof key.n !== 'string' || typeof key.e !== 'string') {
        throw new Error('BoringBuild publisher has no pinned public key');
    }
    decodeBase64Url(key.n, 'public key modulus', 1024);
    decodeBase64Url(key.e, 'public key exponent', 8);
    const thumbprint = (0,external_crypto_namespaceObject.createHash)('sha256')
        .update(JSON.stringify({ e: key.e, kty: 'RSA', n: key.n }))
        .digest('base64url');
    if (key.kid !== thumbprint)
        throw new Error('BoringBuild public key ID is invalid');
    const publicKey = (0,external_crypto_namespaceObject.createPublicKey)({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' });
    if ((publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
        throw new Error('BoringBuild public key is too small');
    }
    return publicKey;
}
function validOrigin(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
    }
    catch {
        return false;
    }
}
function assertIdentity(claims, publisher, subject) {
    if (!validOrigin(publisher.issuer) || !validOrigin(publisher['forge-origin'])
        || claims.iss !== publisher.issuer
        || claims.aud !== subjectAudience(subject)
        || claims.forge_origin !== publisher['forge-origin']
        || claims.repository_id !== publisher['repository-id']
        || claims.workflow_ref !== publisher['workflow-ref']
        || !Array.isArray(publisher['source-refs']) || !publisher['source-refs'].includes(claims.ref)
        || !Array.isArray(publisher.events) || !publisher.events.includes(claims.event_name)
        || claims.boringbuild_source_trust !== 'trusted'
        || claims.boringbuild_ingress !== 'forge'
        || !['1', '2'].includes(String(claims.boringbuild_claims_version))
        || typeof claims.sub !== 'string' || !claims.sub
        || typeof claims.jti !== 'string' || !claims.jti
        || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.nbf)
        || !Number.isSafeInteger(claims.exp)
        || claims.exp <= claims.iat
        || claims.exp - claims.iat > 600
        || claims.nbf > claims.iat
        || claims.iat - claims.nbf > 120
        || claims.iat > Math.floor(Date.now() / 1000) + 120) {
        throw new Error('BoringBuild publisher identity is not authorized');
    }
}
function publishersFromPolicy(request) {
    const policy = request.policy;
    if (!boringbuild_trust_provider_isObject(policy) || policy.encoding !== 'base64')
        throw new Error('policy is invalid');
    const bytes = decodeBase64(policy.data, 'policy', MAX_REQUEST_BYTES);
    const digest = `sha256:${(0,external_crypto_namespaceObject.createHash)('sha256').update(bytes).digest('hex')}`;
    if (policy.sha256 !== digest)
        throw new Error('policy digest mismatch');
    const document = parse(bytes.toString('utf8'));
    const trust = document.trust;
    if (!boringbuild_trust_provider_isObject(trust) || Number(trust.version) !== PROTOCOL_VERSION
        || trust.verifier !== 'boringbuild-oidc' || !Array.isArray(trust.publishers)) {
        throw new Error('policy does not configure BoringBuild OIDC verification');
    }
    return trust.publishers.filter((publisher) => boringbuild_trust_provider_isObject(publisher) && publisher.type === 'boringbuild-oidc');
}
function deny(request, reasonCode) {
    return {
        protocol_version: PROTOCOL_VERSION,
        request_id: request.request_id,
        decision: 'deny',
        subject_digest: subjectDigest(request.subject),
        identity: null,
        reason_code: reasonCode,
    };
}
async function runBoringBuildProvider(request) {
    assertRequest(request);
    if (request.operation === 'attest') {
        const token = await identityToken(request.subject);
        return {
            protocol_version: PROTOCOL_VERSION,
            request_id: request.request_id,
            status: 'success',
            subject_digest: subjectDigest(request.subject),
            bundle: {
                media_type: MEDIA_TYPE,
                encoding: 'base64',
                data: Buffer.from(token).toString('base64'),
            },
        };
    }
    if (request.operation !== 'verify')
        throw new Error('operation must be attest or verify');
    const publishers = publishersFromPolicy(request);
    const bundle = request.bundle;
    if (!boringbuild_trust_provider_isObject(bundle) || bundle.media_type !== MEDIA_TYPE || bundle.encoding !== 'base64') {
        return deny(request, 'invalid_bundle');
    }
    let token;
    let parsed;
    try {
        token = decodeBase64(bundle.data, 'bundle', MAX_BUNDLE_BYTES).toString('utf8');
        parsed = parseToken(token);
    }
    catch {
        return deny(request, 'invalid_bundle');
    }
    for (const publisher of publishers) {
        try {
            const key = pinnedKey(publisher);
            if (parsed.header.kid !== publisher['public-key'].kid
                || !(0,external_crypto_namespaceObject.verify)('RSA-SHA256', Buffer.from(parsed.signed), key, parsed.signature)) {
                continue;
            }
            assertIdentity(parsed.claims, publisher, request.subject);
            return {
                protocol_version: PROTOCOL_VERSION,
                request_id: request.request_id,
                decision: 'allow',
                subject_digest: subjectDigest(request.subject),
                identity: {
                    issuer: publisher.issuer,
                    forge_origin: publisher['forge-origin'],
                    repository_id: publisher['repository-id'],
                    source_ref: parsed.claims.ref,
                    event: parsed.claims.event_name,
                    workflow_ref: publisher['workflow-ref'],
                    key_id: publisher['public-key'].kid,
                },
                reason_code: 'trusted_publisher',
            };
        }
        catch {
            continue;
        }
    }
    return deny(request, 'untrusted_publisher');
}
async function readRequest() {
    const chunks = [];
    let size = 0;
    for await (const chunk of external_process_namespaceObject.stdin) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > MAX_REQUEST_BYTES)
            throw new Error('provider request exceeds 512 KiB');
        chunks.push(bytes);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function main() {
    try {
        external_process_namespaceObject.stdout.write(JSON.stringify(await runBoringBuildProvider(await readRequest())));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`BoringBuild publisher provider failed: ${message}\n`);
        process.exitCode = 1;
    }
}
if (process.argv[1] === __filename) {
    void main();
}

module.exports = __webpack_exports__;
/******/ })()
;