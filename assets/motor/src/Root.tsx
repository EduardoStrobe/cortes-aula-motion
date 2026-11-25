import { Composition } from "remotion";
import { ALT_COMPOSITIONS } from "./aula/alt/register";
import { AulaCut, aulaMetadata } from "./aula/AulaCut";
import { AULAS, AULA_LOOKS } from "./aula/storyboards";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Cuts (src/aula/ENGINE.md): ONE generic composition per storyboard JSON, length = speech + 102 f */}
      {AULAS.map(({ id, storyboard }) => (
        <Composition key={id} id={id} component={AulaCut} durationInFrames={storyboard.frames + 102} fps={30}
          width={1080} height={1920} defaultProps={{ storyboard }} calculateMetadata={aulaMetadata} />
      ))}
      {/* LOOK variants: the same storyboard + a look (src/aula/look.ts, ENGINE.md "Looks") */}
      {AULA_LOOKS.map(({ id, storyboard, look }) => (
        <Composition key={id} id={id} component={AulaCut} durationInFrames={storyboard.frames + 102} fps={30}
          width={1080} height={1920} defaultProps={{ storyboard, look }} calculateMetadata={aulaMetadata} />
      ))}
      {/* ALT format ("light box"): owned by src/aula/alt/ */}
      {ALT_COMPOSITIONS.map((c) => (
        <Composition key={c.id} id={c.id} component={c.component} durationInFrames={c.durationInFrames} fps={30}
          width={1080} height={1920} defaultProps={c.defaultProps} />
      ))}
    </>
  );
};
