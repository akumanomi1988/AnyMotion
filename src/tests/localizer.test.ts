import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEpisode,allDialogue} from '../core/contracts.js';
import {createLocalizationDraft} from '../story/localizer.js';

test('LLM localization preserves stable exact IDs and validates every line',async()=>{
 const episode=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')));
 const expected=JSON.parse(await readFile('examples/pilot.en-US.json','utf8'));
 const provider={modelId:'fake',generateJson:async()=>expected};
 const result=await createLocalizationDraft(episode,'en-US',provider);
 assert.equal(Object.keys(result.lines).length,allDialogue(episode).length);
 await assert.rejects(()=>createLocalizationDraft(episode,'es-ES',provider),/only supports en-US/);
 const bad={modelId:'fake',generateJson:async()=>({...expected,lines:{DL001:'Hello'}})};
 await assert.rejects(()=>createLocalizationDraft(episode,'en-US',bad),/exactly/);
});
