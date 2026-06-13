"use client";

import Script from "next/script";

export const TypekitLoader = () => {
  return (
    <Script
      src="https://use.typekit.net/ik/fOv-mpy588HLSYspB1coUPjrLZXcKW94GtP4olxoBmqfezX2fFHN4UJLFRbh52jhWDjUZAB8F2FqFeIXwDFqFhZq5QscjDIuFg7AMkG0jAFu-WsoShFGZAsude80ZkoRdhXCHKoyjamTiY8Djhy8ZYmC-Ao1Oco8if37OcBDOcu8OfG0-eNkSh9ldhoTdhtldAthSKoDSWmyScmDSeBRZPoRdhXCHKoDSWmyScmDSeBRZWFR-emqiAUTdcS0jhNlOeBRiA8XpWFR-emqiAUTdcS0jhNlOeBRiA8XpWFR-emqiAUTdcS0dcmXOeBDOcu8Oeiu-AsTdciq-WZ8S1FTiYq0jhNlOeyzS1F8OAN0-AN0OAu0F1J0SaBujW48Sagyjh90jhNlOeUzjhBC-eNDifUDSWmyScmDSeBRZWFR-emqiAUTdcS0jhNlOYiaikoyjamTiY8Djhy8ZYmC-Ao1Oco8if37OcBDOcu8OfG0-eNkSh9ldhoTdhtldAthSKoDSWmyScmDSeBRZWFR-emqiAUTdcS0dcmXOeBDOcu8OYiaiko1iA8q-Ao1Ze8hZW4D-WsoOcFzdPUaiaS0-eNkSh9ldhoTdhtldAthSKoDSWmyScmDSeBRZPoRdhXCiaiaO1FUiABkZWF3jAF8ShFGZAsude80ZkoRdhXKfcBqdhoTSkuaZAJ7fbRhmgMMeMb6MKG4fV89IMMjgkMfH6qJrBbbMg65JMJ7fbREmgMMegI6MTMgt4ElR3j.js"
      strategy="afterInteractive"
      onLoad={() => {
        try {
          // @ts-ignore
          window.Typekit.load();
        } catch (e) {}
      }}
    />
  );
};
