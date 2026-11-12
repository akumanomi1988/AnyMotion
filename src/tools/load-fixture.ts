/** Synthetic 9-minute *technical load test*, never a creative episode or publishable asset. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {validateEpisode,type Episode,type CameraShot} from '../core/contracts.js';

export function createNineMinuteLoadFixture():Episode{
  const shotPairs: [CameraShot,CameraShot][]=[['wide','mediumLeo'],['twoShot','mediumVera'],['wide','closeLeo'],['twoShot','closeVera']];
  const scenes=Array.from({length:54},(_,i)=>{
    const startMs=i*10000;
    const [first,second]=shotPairs[i%shotPairs.length]!;
    return {
      sceneId:`SC${String(i+1).padStart(3,'0')}`,
      setId:(['living-room','kitchen','bedroom'] as const)[i%3]!,
      startMs,endMs:startMs+10000,
      camera:[{atMs:startMs,shot:first},{atMs:startMs+5000,shot:second}],
      actions:[
        {id:`AC${String(i*2+1).padStart(3,'0')}`,type:'setExpression' as const,actorId:'leo' as const,atMs:startMs,expression:'happy' as const},
        {id:`AC${String(i*2+2).padStart(3,'0')}`,type:'gesture' as const,actorId:'vera' as const,atMs:startMs+6000,gesture:'crossArms' as const,durationMs:1800},
      ],
      dialogue:[
        {lineId:`DL${String(i*2+1).padStart(3,'0')}`,characterId:'leo' as const,startMs:startMs+650,endMs:startMs+4200,text:'Esto es un ensayo técnico de duración y sincronización.'},
        {lineId:`DL${String(i*2+2).padStart(3,'0')}`,characterId:'vera' as const,startMs:startMs+5450,endMs:startMs+9350,text:'No es un capítulo creativo, solo una prueba de carga.'}
      ]
    };
  });
  return validateEpisode({schemaVersion:'1.0',episodeId:'LOADTEST009',title:'LOAD TEST ONLY - NOT FOR PUBLICATION',sourceLocale:'es-ES',canvas:{width:1280,height:720},fps:30,durationMs:540000,scenes});
}

if(process.argv[1]?.endsWith('load-fixture.js')){
 const out=resolve(process.argv[2]??'workspace/loadtest-9min.json');
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(createNineMinuteLoadFixture(),null,2)+'\n',{flag:'wx'});
 console.log(`Synthetic 9-minute fixture written to ${out}; NOT FOR PUBLICATION`);
}
