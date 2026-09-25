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
let DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[T ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|[-+]\d{2}:\d{2})?$/i;
class TomlDate extends Date {
    #hasDate = false;
    #hasTime = false;
    #offset = null;
    constructor(date) {
        let hasDate = true;
        let hasTime = true;
        let offset = 'Z';
        if (typeof date === 'string') {
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
                    date = date.toUpperCase();
                    if (!offset && hasTime)
                        date += 'Z';
                }
            }
            else {
                date = '';
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
        if (this.#offset === 'Z')
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
    let lines = string.slice(0, ptr).split(/\r\n|\n|\r/g);
    return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
    let lines = string.split(/\r\n|\n|\r/g);
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
function indexOfNewline(str, start = 0) {
    let idx = str.indexOf('\n', start);
    if (str.charCodeAt(idx - 1) === 0xd /* \r */)
        idx--;
    return idx;
}
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
            throw new TomlError('control characters are not allowed in comments', {
                toml: ctx.s,
                ptr: ctx.p,
            });
        }
    }
}
/** @internal */
function skipVoid(ctx, banNewLines, banComments) {
    let c;
    while (1) {
        while ((c = ctx.s.charCodeAt(ctx.p)) === 0x20 ||
            c === 0x9 /* \t */ ||
            (!banNewLines &&
                (c === 0xa /* \n */ || (c === 0xd /* \r */ && ctx.s.charCodeAt(ctx.p + 1) === 0xa /* \n */))))
            ctx.p++;
        if (banComments || c !== 0x23 /* # */)
            break;
        skipComment(ctx);
    }
}
/** @internal */
function skipUntil(ctx, sep, end) {
    let ptr = ctx.p;
    if (!end) {
        ptr = indexOfNewline(ctx.s, ptr);
        ctx.p = ptr < 0 ? ctx.s.length : ptr;
        return;
    }
    for (; ctx.p < ctx.s.length; ctx.p++) {
        let c = ctx.s.charCodeAt(ctx.p);
        if (c === 0x23 /* # */) {
            skipComment(ctx);
        }
        else if (c === end || c === sep) {
            return;
        }
    }
    throw new TomlError('cannot find end of structure', {
        toml: ctx.s,
        ptr,
    });
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



// let CTRL_REGEX = /[\x00-\x08\x0f-\x1f\x7f]/
let INT_REGEX = /^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/;
let FLOAT_REGEX = /^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/;
let LEADING_ZERO = /^[+-]?0[0-9_]/;
/** @internal */
function parseString(ctx) {
    let start = ctx.p;
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
    /*
    The fast path does not seem to bring significant performance gains, so it's commented out.
    Kept for reference and/or future fafoing.

    Without: spec  5.08 µs/iter    3.88 ipc (99.44% cache)   23.90 branch misses   28.61k cycles    111.01k instructions
             5MB   115.73 ms/iter  2.51 ipc (98.36% cache)   3.12M branch misses   619.30M cycles   1.56G instructions

    With:    spec  5.09 µs/iter    3.90 ipc (99.46% cache)   24.42 branch misses   28.57k cycles    111.49k instructions
             5MB   113.89 ms/iter  2.47 ipc (98.38% cache)   3.12M branch misses   611.94M cycles   1.51G instructions

    if (c === "'") {
        // Literal strings fast path - no transform needs to occur; just grab the str and that's it
        let endPtr = str.indexOf(isMultiline ? "'''" : "'", ptr)
        if (endPtr < 0) {
            throw new TomlError("unfinished string literal", { toml: str, ptr })
        }

        if (isMultiline) {
            // If the string ends with 4-5 quotes, then the first 1-2 are part of the string
            if (str[endPtr + 3] === "'") endPtr++
            if (str[endPtr + 3] === "'") endPtr++
        }

        let string = str.slice(ptr, endPtr)
        if (CTRL_REGEX.test(string)) {
            let match = string.match(CTRL_REGEX)!
            throw new TomlError('control characters are not allowed in strings', { toml: str, ptr: ptr + (match.index ?? 0) })
        }
        return [string, endPtr + (isMultiline ? 3 : 1)]
    }
    */
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
            throw new TomlError('control characters are not allowed in strings', {
                toml: ctx.s,
                ptr: ctx.p,
            });
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
            if (!state)
                parsed += ctx.s.slice(sliceStart, ctx.p);
            ctx.p += isMultiline ? 3 : 1;
            return parsed;
        }
        else if (!state) {
            if (!isLiteral && c === 0x5c /* \ */) {
                parsed += ctx.s.slice(sliceStart, (sliceStart = ctx.p));
                state = 1;
            }
        }
        else if (state === 1) {
            if (c === 0x78 /* x */ || c === 0x75 /* u */ || c === 0x55 /* U */) { // Unicode escape
                let value = 0;
                let len = c === 0x78 /* x */ ? 2 : c === 0x75 /* u */ ? 4 : 8;
                for (let j = 0; j < len; j++, ctx.p++) {
                    let hex = ctx.s.charCodeAt(ctx.p + 1);
                    let digit = 
                    /* 0-9 */ hex >= 0x30 && hex <= 0x39 ? hex - 0x30 :
                        /* A-F */ hex >= 0x41 && hex <= 0x46 ? hex - 0x41 + 10 :
                            /* a-f */ hex >= 0x61 && hex <= 0x66 ? hex - 0x61 + 10 : -1;
                    if (digit < 0)
                        throw new TomlError('invalid non-hex character in unicode escape', { toml: ctx.s, ptr: ctx.p + 1 });
                    value = (value << 4) | digit;
                }
                // Because JS does bitwise on signed 32bit integers, all 0xfzzzzzzz values are actually seen as negative
                if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
                    throw new TomlError('invalid unicode escape', { toml: ctx.s, ptr: ctx.p });
                }
                parsed += String.fromCodePoint(value);
                sliceStart = ctx.p + 1;
                state = 0;
            }
            else if (c === 0x20 || c === 0x9 /* \t */) { // If it was a newline, it'd have been handled earlier
                state = 2;
            }
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
                    throw new TomlError('unrecognized escape sequence', { toml: ctx.s, ptr: ctx.p });
                sliceStart = ctx.p + 1;
                state = 0;
            }
        }
        else if (c !== 0x20 && c !== 0x9 /* \t */) {
            if (state === 2) {
                throw new TomlError('invalid escape: only line-ending whitespace may be escaped', {
                    toml: ctx.s,
                    ptr: sliceStart,
                });
            }
            // State cannot be zero, or we'd have branched earlier already.
            // If it's a backslash, immediately transition to the escape state so it can be processed.
            state = !isLiteral && c === 0x5c /* \ */ ? 1 : 0;
            sliceStart = ctx.p;
        }
    }
    throw new TomlError('unfinished string', { toml: ctx.s, ptr: start });
}
function sliceAndTrimEndOf(ctx, start, end) {
    let value = ctx.s.slice(start, end);
    let commentIdx = value.indexOf('#');
    if (commentIdx > 0) {
        // The call to skipComment allows to "validate" the comment
        // (absence of control characters)
        skipComment({ s: value, p: commentIdx, d: 0 });
        value = value.slice(0, commentIdx);
    }
    return value.trimEnd();
}
/** @internal */
function parseValue(ctx, integersAsBigInt, end) {
    let ptr = ctx.p;
    let err = { toml: ctx.s, ptr };
    skipUntil(ctx, 0x2c /* , */, end);
    let value = sliceAndTrimEndOf(ctx, ptr, ctx.p);
    if (!value)
        throw new TomlError('incomplete declaration: value expected', err);
    if (value === '-inf')
        return -Infinity;
    if (value === 'inf' || value === '+inf')
        return Infinity;
    if (value === 'nan' || value === '+nan' || value === '-nan')
        return NaN;
    // Avoid FP representation of -0
    if (value === '-0')
        return integersAsBigInt ? 0n : 0;
    // Numbers
    let isInt = INT_REGEX.test(value);
    if (isInt || FLOAT_REGEX.test(value)) {
        if (LEADING_ZERO.test(value)) {
            throw new TomlError('leading zeroes are not allowed', err);
        }
        value = value.replace(/_/g, '');
        let numeric = +value;
        if (isNaN(numeric)) {
            throw new TomlError('invalid number', err);
        }
        if (isInt) {
            if ((isInt = !Number.isSafeInteger(numeric)) && !integersAsBigInt) {
                throw new TomlError('integer value cannot be represented losslessly', err);
            }
            if (isInt || integersAsBigInt === true)
                numeric = BigInt(value);
        }
        return numeric;
    }
    const date = new TomlDate(value);
    if (!date.isValid())
        throw new TomlError('invalid value', err);
    return date;
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



/** @internal */
function extractValue(ctx, end, integersAsBigInt) {
    let ptr = ctx.p;
    let c = ctx.s.charCodeAt(ptr);
    // Structs
    if (c === 0x5b /* [ */ || c === 0x7b /* { */) {
        if (!ctx.d--) {
            throw new TomlError('document contains excessively nested structures. aborting.', {
                toml: ctx.s,
                ptr,
            });
        }
        let value = c === 0x5b /* [ */
            ? parseArray(ctx, integersAsBigInt)
            : parseInlineTable(ctx, integersAsBigInt);
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
            throw new TomlError('invalid value', { toml: ctx.s, ptr });
        ctx.p++;
        return true;
    }
    if (c === 0x66 /* f */) { // Only possible valid value is `false`
        if (ctx.s.charCodeAt(++ctx.p) !== 0x61 || ctx.s.charCodeAt(++ctx.p) !== 0x6c || ctx.s.charCodeAt(++ctx.p) !== 0x73 || ctx.s.charCodeAt(++ctx.p) !== 0x65)
            throw new TomlError('invalid value', { toml: ctx.s, ptr });
        ctx.p++;
        return false;
    }
    // Legacy logic for numbers and dates. Slow and needs to be rewritten.
    return parseValue(ctx, integersAsBigInt, end);
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




let KEY_PART_RE = /^[a-zA-Z0-9-_]+[ \t]*$/;
/** @internal */
function parseKey(ctx, end = '=') {
    let start = ctx.p;
    let dot = start - 1;
    let parsed = [];
    let endPtr = ctx.s.indexOf(end, start);
    if (endPtr < 0) {
        throw new TomlError('incomplete key-value: cannot find end of key', {
            toml: ctx.s,
            ptr: start,
        });
    }
    do {
        let c = ctx.s.charCodeAt(ctx.p = ++dot);
        // If it's whitespace, ignore
        if (c !== 0x20 && c !== 0x9 /* \t */) {
            // If it's a string
            if (c === 0x22 /* " */ || c === 0x27 /* ' */) {
                if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2)) {
                    throw new TomlError('multiline strings are not allowed in keys', {
                        toml: ctx.s,
                        ptr: ctx.p,
                    });
                }
                let part = parseString(ctx);
                dot = ctx.s.indexOf('.', ctx.p);
                let strEnd = ctx.s.slice(ctx.p, dot < 0 || dot > endPtr ? endPtr : dot);
                let newLine = indexOfNewline(strEnd);
                if (newLine > -1) {
                    throw new TomlError('newlines are not allowed in keys', {
                        toml: ctx.s,
                        ptr: newLine,
                    });
                }
                if (strEnd.trimStart()) {
                    throw new TomlError('found extra tokens after the string part', {
                        toml: ctx.s,
                        ptr: ctx.p,
                    });
                }
                if (endPtr < ctx.p) {
                    endPtr = ctx.s.indexOf(end, ctx.p);
                    if (endPtr < 0) {
                        throw new TomlError('incomplete key-value: cannot find end of key', {
                            toml: ctx.s,
                            ptr: start,
                        });
                    }
                }
                parsed.push(part);
            }
            else {
                // Normal raw key part consumption and validation
                dot = ctx.s.indexOf('.', ctx.p);
                let part = ctx.s.slice(ctx.p, dot < 0 || dot > endPtr ? endPtr : dot);
                if (!KEY_PART_RE.test(part)) {
                    throw new TomlError('only letter, numbers, dashes and underscores are allowed in keys', {
                        toml: ctx.s,
                        ptr: ctx.p,
                    });
                }
                parsed.push(part.trimEnd());
            }
        }
        // Until there's no more dot
    } while (dot + 1 && dot < endPtr);
    ctx.p = endPtr + 1;
    skipVoid(ctx, true, true);
    return parsed;
}
/** @internal */
function parseInlineTable(ctx, integersAsBigInt) {
    let res = {};
    let seen = new Set();
    let c;
    ctx.p++;
    while (ctx.p < ctx.s.length) {
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p)) === 0x7d /* } */) {
            ctx.p++;
            return res;
        }
        let k;
        let t = res;
        let hasOwn = false;
        let p = ctx.p;
        let key = parseKey(ctx);
        for (let i = 0; i < key.length; i++) {
            if (i)
                t = hasOwn ? t[k] : (t[k] = {});
            k = key[i];
            if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== 'object' || seen.has(t[k]))) {
                throw new TomlError('trying to redefine an already defined value', {
                    toml: ctx.s,
                    ptr: p,
                });
            }
            if (!hasOwn && k === '__proto__') {
                Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
            }
        }
        if (hasOwn) {
            throw new TomlError('trying to redefine an already defined value', {
                toml: ctx.s,
                ptr: ctx.p,
            });
        }
        let value = extractValue(ctx, 0x7d /* } */, integersAsBigInt);
        seen.add(t[k] = value);
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p++)) === 0x7d /* } */) {
            return res;
        }
        if (c !== 0x2c /* , */) {
            throw new TomlError('expected comma or end of structure', { toml: ctx.s, ptr: ctx.p - 1 });
        }
    }
    throw new TomlError('unfinished table encountered', {
        toml: ctx.s,
        ptr: ctx.p,
    });
}
/** @internal */
function parseArray(ctx, integersAsBigInt) {
    let res = [];
    let c;
    ctx.p++;
    while (ctx.p < ctx.s.length) {
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p)) === 0x5d /* ] */) {
            ctx.p++;
            return res;
        }
        res.push(extractValue(ctx, 0x5d /* ] */, integersAsBigInt));
        skipVoid(ctx);
        if ((c = ctx.s.charCodeAt(ctx.p++)) === 0x5d /* ] */) {
            return res;
        }
        if (c !== 0x2c /* , */) {
            throw new TomlError('expected comma or end of structure', { toml: ctx.s, ptr: ctx.p - 1 });
        }
    }
    throw new TomlError('unfinished array encountered', {
        toml: ctx.s,
        ptr: ctx.p,
    });
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




function peekTable(key, table, meta, type) {
    let t = table;
    let m = meta;
    let k;
    let hasOwn = false;
    let state;
    for (let i = 0; i < key.length; i++) {
        if (i) {
            t = hasOwn ? t[k] : (t[k] = {});
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
            if (k === '__proto__') {
                Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
                Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
            }
            m[k] = {
                t: i < key.length - 1 && type === 2 /* Type.ARRAY */
                    ? 3 /* Type.ARRAY_DOTTED */ : type,
                d: false,
                i: 0,
                c: {},
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
        t[k].push(t = {});
        state.c[state.i++] = (state = { t: 1 /* Type.EXPLICIT */, d: false, i: 0, c: {} });
    }
    if (state.d) {
        // Redefining a table!
        return null;
    }
    state.d = true;
    if (type === 1 /* Type.EXPLICIT */) {
        t = hasOwn ? t[k] : (t[k] = {});
    }
    else if (type === 0 /* Type.DOTTED */ && hasOwn) {
        return null;
    }
    return [k, t, state.c];
}
function parse(toml, { maxDepth = 1000, integersAsBigInt } = {}) {
    let ctx = { s: toml, p: 0, d: maxDepth };
    let res = {};
    let meta = {};
    let tmp;
    let tbl = res;
    let m = meta;
    skipVoid(ctx);
    while (ctx.p < toml.length) {
        if (toml.charCodeAt(ctx.p) === 0x5b /* [ */) {
            let isTableArray = toml.charCodeAt(++ctx.p) === 0x5b; /* [ */
            tmp = ctx.p += +isTableArray;
            let k = parseKey(ctx, ']');
            if (isTableArray) {
                if (toml.charCodeAt(ctx.p - 1) !== 0x5d /* ] */) {
                    throw new TomlError('expected end of table declaration', {
                        toml: toml,
                        ptr: ctx.p - 1,
                    });
                }
                ctx.p++;
            }
            let p = peekTable(k, res, meta, isTableArray ? 2 /* Type.ARRAY */ : 1 /* Type.EXPLICIT */);
            if (!p) {
                throw new TomlError('trying to redefine an already defined table or value', {
                    toml: toml,
                    ptr: tmp,
                });
            }
            m = p[2];
            tbl = p[1];
        }
        else {
            tmp = ctx.p;
            let k = parseKey(ctx);
            let p = peekTable(k, tbl, m, 0 /* Type.DOTTED */);
            if (!p) {
                throw new TomlError('trying to redefine an already defined table or value', {
                    toml: toml,
                    ptr: tmp,
                });
            }
            p[1][p[0]] = extractValue(ctx, void 0, integersAsBigInt);
        }
        skipVoid(ctx, true);
        if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 0xa /* \n */ && tmp !== 0xd /* \r */) {
            throw new TomlError('each key-value declaration must be followed by an end-of-line', {
                toml: toml,
                ptr: ctx.p,
            });
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
function extendedTypeOf(obj) {
    let type = typeof obj;
    if (type === 'object') {
        if (Array.isArray(obj))
            return 'array';
        if (typeof obj?.getUTCDate === 'function' && obj instanceof Date)
            return 'date';
        if (globalThis.Temporal &&
            // check for the 'since' property as an early bailout that avoids running all 5 instanceof checks
            typeof obj?.since === 'function' &&
            (obj instanceof Temporal.Instant ||
                obj instanceof Temporal.PlainDate ||
                obj instanceof Temporal.PlainDateTime ||
                obj instanceof Temporal.PlainTime ||
                obj instanceof Temporal.ZonedDateTime)) {
            return 'temporal';
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
function formatString(s) {
    return JSON.stringify(s).replace(/\x7f/g, '\\u007f');
}
function stringifyTemporal(temporal) {
    return temporal.toString({
        calendarName: 'never',
        timeZoneName: 'never',
    });
}
function stringifyValue(val, type, depth, numberAsFloat) {
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
            return val.toString();
        case 'string':
            return formatString(val);
        case 'date':
            if (isNaN(val.getTime()))
                throw new TypeError('cannot serialize invalid date');
            return val.toISOString();
        case 'object':
            return stringifyInlineTable(val, depth, numberAsFloat);
        case 'array':
            return stringifyArray(val, depth, numberAsFloat);
        case 'temporal':
            return stringifyTemporal(val);
    }
}
function stringifyInlineTable(obj, depth, numberAsFloat) {
    let keys = Object.keys(obj);
    if (keys.length === 0)
        return '{}';
    let res = '{ ';
    for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        if (i)
            res += ', ';
        res += BARE_KEY.test(k) ? k : formatString(k);
        res += ' = ';
        res += stringifyValue(obj[k], extendedTypeOf(obj[k]), depth - 1, numberAsFloat);
    }
    return res + ' }';
}
function stringifyArray(array, depth, numberAsFloat) {
    if (array.length === 0)
        return '[]';
    let res = '[ ';
    for (let i = 0; i < array.length; i++) {
        if (i)
            res += ', ';
        if (array[i] === null || array[i] === void 0) {
            throw new TypeError('arrays cannot contain null or undefined values');
        }
        res += stringifyValue(array[i], extendedTypeOf(array[i]), depth - 1, numberAsFloat);
    }
    return res + ' ]';
}
function stringifyArrayTable(array, key, depth, numberAsFloat) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    let res = '';
    for (let i = 0; i < array.length; i++) {
        res += `${res && '\n'}[[${key}]]\n`;
        res += stringifyTable(0, array[i], key, depth, numberAsFloat);
    }
    return res;
}
function stringifyTable(tableKey, obj, prefix, depth, numberAsFloat) {
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
            let key = BARE_KEY.test(k) ? k : formatString(k);
            if (type === 'array' && isArrayOfTables(obj[k])) {
                tables += (tables && '\n') + stringifyArrayTable(obj[k], prefix ? `${prefix}.${key}` : key, depth - 1, numberAsFloat);
            }
            else if (type === 'object') {
                let tblKey = prefix ? `${prefix}.${key}` : key;
                tables += (tables && '\n') + stringifyTable(tblKey, obj[k], tblKey, depth - 1, numberAsFloat);
            }
            else {
                preamble += key;
                preamble += ' = ';
                preamble += stringifyValue(obj[k], type, depth, numberAsFloat);
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
function stringify(obj, { maxDepth = 1000, numbersAsFloat = false } = {}) {
    if (extendedTypeOf(obj) !== 'object') {
        throw new TypeError('stringify can only be called with an object');
    }
    let str = stringifyTable(0, obj, '', maxDepth, numbersAsFloat);
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




/* harmony default export */ const dist = ({ parse: parse, stringify: stringify, TomlDate: TomlDate, TomlError: TomlError });


;// CONCATENATED MODULE: ./dist/boringbuild-trust-provider.js



const PROTOCOL_VERSION = 1;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_BUNDLE_BYTES = 256 * 1024;
const MAX_TOKEN_BYTES = 64 * 1024;
const MEDIA_TYPE = 'application/vnd.boringbuild.publisher-oidc+jwt';
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function subjectAudience(subject) {
    return `urn:boringcache:publisher:v1:${subject.kind}:sha256:${subject.digest.sha256}`;
}
function subjectDigest(subject) {
    return `sha256:${subject.digest.sha256}`;
}
function assertRequest(value) {
    if (!isObject(value) || value.protocol_version !== PROTOCOL_VERSION
        || typeof value.request_id !== 'string' || !/^[0-9a-f-]{36}$/.test(value.request_id)
        || !isObject(value.subject) || ![
        'archive', 'archive-graph', 'oci', 'gha-cache', 'kv-batch', 'artifact', 'registry',
    ].includes(String(value.subject.kind))
        || !isObject(value.subject.digest)
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
    let response;
    try {
        response = await fetch(url, {
            headers: { authorization: `Bearer ${requestToken}` },
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
        });
    }
    finally {
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    }
    if (!response.ok || !response.body)
        throw new Error(`BoringBuild OIDC request failed with HTTP ${response.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > MAX_TOKEN_BYTES)
            throw new Error('BoringBuild OIDC response is too large');
        chunks.push(bytes);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(payload) || typeof payload.value !== 'string'
        || payload.value.length > MAX_TOKEN_BYTES || /\s/.test(payload.value)) {
        throw new Error('BoringBuild OIDC response is invalid');
    }
    return payload.value;
}
function parseToken(token) {
    if (Buffer.byteLength(token) > MAX_TOKEN_BYTES)
        throw new Error('OIDC token is too large');
    const parts = token.split('.');
    if (parts.length !== 3)
        throw new Error('OIDC token is invalid');
    const header = JSON.parse(decodeBase64Url(parts[0], 'OIDC header', 2048).toString('utf8'));
    const claims = JSON.parse(decodeBase64Url(parts[1], 'OIDC claims', 32 * 1024).toString('utf8'));
    if (!isObject(header) || !isObject(claims) || header.alg !== 'RS256' || header.typ !== 'JWT'
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
    if (!isObject(key) || typeof key.kid !== 'string'
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
    if (!isObject(policy) || policy.encoding !== 'base64')
        throw new Error('policy is invalid');
    const bytes = decodeBase64(policy.data, 'policy', MAX_REQUEST_BYTES);
    const digest = `sha256:${(0,external_crypto_namespaceObject.createHash)('sha256').update(bytes).digest('hex')}`;
    if (policy.sha256 !== digest)
        throw new Error('policy digest mismatch');
    const document = parse(bytes.toString('utf8'));
    const trust = document.trust;
    if (!isObject(trust) || Number(trust.version) !== PROTOCOL_VERSION
        || trust.verifier !== 'boringbuild-oidc' || !Array.isArray(trust.publishers)) {
        throw new Error('policy does not configure BoringBuild OIDC verification');
    }
    return trust.publishers.filter((publisher) => isObject(publisher) && publisher.type === 'boringbuild-oidc');
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
    if (!isObject(bundle) || bundle.media_type !== MEDIA_TYPE || bundle.encoding !== 'base64') {
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