import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePcm16Wave} from '../audio/dubbing.js';
function makeWav(rate=24000):Buffer{
 const pcm=Buffer.alloc(rate*2);pcm.writeInt16LE(300,0);
 const wav=Buffer.alloc(44+pcm.length);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
 wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);
 wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
 pcm.copy(wav,44);return wav;
}
test('strict WAV parser can directly extract PCM16 at source rate without FFprobe or FFmpeg',()=>{
 const wav=makeWav();const parsed=parsePcm16Wave(wav);
 assert.equal(parsed?.sampleRate,24000);
 assert.equal(parsed?.samples.length,48000);
 assert.equal(parsed?.samples.readInt16LE(0),300);
 assert.equal(parsePcm16Wave(makeWav(22050))?.sampleRate,22050);
});
test('strict WAV parser rejects malformed declared bytes and unsupported formats',()=>{
 const wav=makeWav();
 const corrupt=Buffer.from(wav);corrupt.writeUInt32LE(0xffffffff,4);
 assert.throws(()=>parsePcm16Wave(corrupt),/Malformed/);
 const invalid=Buffer.from(wav);invalid.writeUInt32LE(0xffffffff,40);
 assert.throws(()=>parsePcm16Wave(invalid),/chunk length/);
 const stereo=Buffer.from(wav);stereo.writeUInt16LE(2,22);
 assert.equal(parsePcm16Wave(stereo),null);
 assert.equal(parsePcm16Wave(Buffer.from('not a wave')),null);
});
