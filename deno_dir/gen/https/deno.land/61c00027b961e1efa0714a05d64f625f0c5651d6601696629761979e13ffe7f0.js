import { BLOCK_MAX_BUFFER_LEN, BTYPE, CODELEN_VALUES, DISTANCE_EXTRA_BIT_BASE, DISTANCE_EXTRA_BIT_LEN, LENGTH_EXTRA_BIT_BASE, LENGTH_EXTRA_BIT_LEN, } from "./const.ts";
import { generateDeflateHuffmanTable } from "./huffman.ts";
import { generateLZ77Codes } from "./lz77.ts";
import { BitWriteStream } from "./_BitWriteStream.ts";
export function deflate(input) {
    const inputLength = input.length;
    const streamHeap = (inputLength < BLOCK_MAX_BUFFER_LEN / 2)
        ? BLOCK_MAX_BUFFER_LEN
        : inputLength * 2;
    const stream = new BitWriteStream(new Uint8Array(streamHeap));
    let processedLength = 0;
    let targetLength = 0;
    while (true) {
        if (processedLength + BLOCK_MAX_BUFFER_LEN >= inputLength) {
            targetLength = inputLength - processedLength;
            stream.writeRange(1, 1);
        }
        else {
            targetLength = BLOCK_MAX_BUFFER_LEN;
            stream.writeRange(0, 1);
        }
        stream.writeRange(BTYPE.DYNAMIC, 2);
        deflateDynamicBlock(stream, input, processedLength, targetLength);
        processedLength += BLOCK_MAX_BUFFER_LEN;
        if (processedLength >= inputLength) {
            break;
        }
    }
    if (stream.nowBitsIndex !== 0) {
        stream.writeRange(0, 8 - stream.nowBitsIndex);
    }
    return stream.buffer.subarray(0, stream.bufferIndex);
}
function deflateUncompressedBlock(stream, input, inputIndex) {
    stream.writeRange(0, 5);
    const LEN = (input.length - inputIndex > 0xffff) ? 0xffff : input.length;
    const NLEN = 0xffff - LEN;
    stream.writeRange(LEN & 0xff, 8);
    stream.writeRange(LEN >> 8, 8);
    stream.writeRange(NLEN & 0xff, 8);
    stream.writeRange(NLEN >> 8, 8);
    for (let i = 0; i < LEN; i++) {
        stream.writeRange(input[inputIndex], 8);
        inputIndex++;
    }
    return inputIndex;
}
function deflateDynamicBlock(stream, input, startIndex, targetLength) {
    const lz77Codes = generateLZ77Codes(input, startIndex, targetLength);
    const clCodeValues = [256];
    const distanceCodeValues = [];
    let clCodeValueMax = 256;
    let distanceCodeValueMax = 0;
    for (let i = 0, iMax = lz77Codes.length; i < iMax; i++) {
        const values = lz77Codes[i];
        let cl = values[0];
        const distance = values[1];
        if (distance !== undefined) {
            cl += 257;
            distanceCodeValues.push(distance);
            if (distanceCodeValueMax < distance) {
                distanceCodeValueMax = distance;
            }
        }
        clCodeValues.push(cl);
        if (clCodeValueMax < cl) {
            clCodeValueMax = cl;
        }
    }
    const dataHuffmanTables = generateDeflateHuffmanTable(clCodeValues);
    const distanceHuffmanTables = generateDeflateHuffmanTable(distanceCodeValues);
    const codelens = [];
    for (let i = 0; i <= clCodeValueMax; i++) {
        if (dataHuffmanTables.has(i)) {
            codelens.push(dataHuffmanTables.get(i).bitlen);
        }
        else {
            codelens.push(0);
        }
    }
    const HLIT = codelens.length;
    for (let i = 0; i <= distanceCodeValueMax; i++) {
        if (distanceHuffmanTables.has(i)) {
            codelens.push(distanceHuffmanTables.get(i).bitlen);
        }
        else {
            codelens.push(0);
        }
    }
    const HDIST = codelens.length - HLIT;
    const runLengthCodes = [];
    const runLengthRepeatCount = [];
    let codelen = 0;
    let repeatLength = 0;
    for (let i = 0; i < codelens.length; i++) {
        codelen = codelens[i];
        repeatLength = 1;
        while (codelen === codelens[i + 1]) {
            repeatLength++;
            i++;
            if (codelen === 0) {
                if (138 <= repeatLength) {
                    break;
                }
            }
            else {
                if (6 <= repeatLength) {
                    break;
                }
            }
        }
        if (4 <= repeatLength) {
            if (codelen === 0) {
                if (11 <= repeatLength) {
                    runLengthCodes.push(18);
                }
                else {
                    runLengthCodes.push(17);
                }
            }
            else {
                runLengthCodes.push(codelen);
                runLengthRepeatCount.push(1);
                repeatLength--;
                runLengthCodes.push(16);
            }
            runLengthRepeatCount.push(repeatLength);
        }
        else {
            for (let j = 0; j < repeatLength; j++) {
                runLengthCodes.push(codelen);
                runLengthRepeatCount.push(1);
            }
        }
    }
    const codelenHuffmanTable = generateDeflateHuffmanTable(runLengthCodes, 7);
    let HCLEN = 0;
    CODELEN_VALUES.forEach((value, index) => {
        if (codelenHuffmanTable.has(value)) {
            HCLEN = index + 1;
        }
    });
    stream.writeRange(HLIT - 257, 5);
    stream.writeRange(HDIST - 1, 5);
    stream.writeRange(HCLEN - 4, 4);
    let codelenTableObj;
    for (let i = 0; i < HCLEN; i++) {
        codelenTableObj = codelenHuffmanTable.get(CODELEN_VALUES[i]);
        if (codelenTableObj !== undefined) {
            stream.writeRange(codelenTableObj.bitlen, 3);
        }
        else {
            stream.writeRange(0, 3);
        }
    }
    runLengthCodes.forEach((value, index) => {
        codelenTableObj = codelenHuffmanTable.get(value);
        if (codelenTableObj !== undefined) {
            stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
        }
        else {
            throw new Error("Data is corrupted");
        }
        if (value === 18) {
            stream.writeRange(runLengthRepeatCount[index] - 11, 7);
        }
        else if (value === 17) {
            stream.writeRange(runLengthRepeatCount[index] - 3, 3);
        }
        else if (value === 16) {
            stream.writeRange(runLengthRepeatCount[index] - 3, 2);
        }
    });
    for (let i = 0, iMax = lz77Codes.length; i < iMax; i++) {
        const values = lz77Codes[i];
        const clCodeValue = values[0];
        const distanceCodeValue = values[1];
        if (distanceCodeValue !== undefined) {
            codelenTableObj = dataHuffmanTables.get(clCodeValue + 257);
            if (codelenTableObj === undefined) {
                throw new Error("Data is corrupted");
            }
            stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
            if (0 < LENGTH_EXTRA_BIT_LEN[clCodeValue]) {
                repeatLength = values[2];
                stream.writeRange(repeatLength - LENGTH_EXTRA_BIT_BASE[clCodeValue], LENGTH_EXTRA_BIT_LEN[clCodeValue]);
            }
            const distanceTableObj = distanceHuffmanTables.get(distanceCodeValue);
            if (distanceTableObj === undefined) {
                throw new Error("Data is corrupted");
            }
            stream.writeRangeCoded(distanceTableObj.code, distanceTableObj.bitlen);
            if (0 < DISTANCE_EXTRA_BIT_LEN[distanceCodeValue]) {
                const distance = values[3];
                stream.writeRange(distance - DISTANCE_EXTRA_BIT_BASE[distanceCodeValue], DISTANCE_EXTRA_BIT_LEN[distanceCodeValue]);
            }
        }
        else {
            codelenTableObj = dataHuffmanTables.get(clCodeValue);
            if (codelenTableObj === undefined) {
                throw new Error("Data is corrupted");
            }
            stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
        }
    }
    codelenTableObj = dataHuffmanTables.get(256);
    if (codelenTableObj === undefined) {
        throw new Error("Data is corrupted");
    }
    stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmbGF0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlZmxhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLG9CQUFvQixFQUNwQixLQUFLLEVBQ0wsY0FBYyxFQUNkLHVCQUF1QixFQUN2QixzQkFBc0IsRUFDdEIscUJBQXFCLEVBQ3JCLG9CQUFvQixHQUNyQixNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDM0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQzlDLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUV0RCxNQUFNLFVBQVUsT0FBTyxDQUFDLEtBQWlCO0lBQ3ZDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDakMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxXQUFXLEdBQUcsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO1FBQ3pELENBQUMsQ0FBQyxvQkFBb0I7UUFDdEIsQ0FBQyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7SUFDcEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxjQUFjLENBQUMsSUFBSSxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUM5RCxJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUM7SUFDeEIsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLE9BQU8sSUFBSSxFQUFFO1FBQ1gsSUFBSSxlQUFlLEdBQUcsb0JBQW9CLElBQUksV0FBVyxFQUFFO1lBQ3pELFlBQVksR0FBRyxXQUFXLEdBQUcsZUFBZSxDQUFDO1lBQzdDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ3pCO2FBQU07WUFDTCxZQUFZLEdBQUcsb0JBQW9CLENBQUM7WUFDcEMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENB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