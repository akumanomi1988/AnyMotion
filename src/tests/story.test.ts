import test from 'node:test';
import assert from 'node:assert/strict';
import {createStory,validateStoryBrief,OpenAICompatibleStoryProvider,validateGeneratedEpisode,storyWarnings} from '../story/llm.js';
import {readFile} from 'node:fs/promises';

test('story brief rejects invalid fields, duration and injection-like extras',()=>{
 const base={schemaVersion:'1.0',episodeId:'EP0003',premise:'A long enough original domestic conflict.',targetMinutes:9,priorSummaries:[]};
 assert.equal(validateStoryBrief(base).targetMinutes,9);
 assert.throws(()=>validateStoryBrief({...base,targetMinutes:12}),/duration/);
 assert.throws(()=>validateStoryBrief({...base,script:'require(\"fs\")'}),/fields/);
});

test('untrusted model output cannot bypass episode validation',async()=>{
 const brief=validateStoryBrief(JSON.parse(await readFile('examples/story-brief.json','utf8')));
 const fake={modelId:'fake',generateJson:async()=>({schemaVersion:'1.0',runCode:'console.log(1)'})};
 await assert.rejects(()=>createStory(brief,fake),/Invalid episode/);
 assert.throws(()=>validateGeneratedEpisode({schemaVersion:'1.0'},brief),/Invalid episode/);
});

test('LLM provider requires TLS and explicit credentials',()=>{
 assert.throws(()=>new OpenAICompatibleStoryProvider({endpoint:'http://external.example/v1/chat/completions',apiKey:'key',model:'mock'}),/HTTPS/);
 assert.throws(()=>new OpenAICompatibleStoryProvider({endpoint:'https://example.com/v1/chat/completions',apiKey:'',model:'mock'}),/API key/);
});
