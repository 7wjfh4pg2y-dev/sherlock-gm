const SUPABASE_URL = 'https://aczebumbhhqhagtshtpm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjemVidW1iaGhxaGFndHNodHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA0MTYsImV4cCI6MjA5NTcwNjQxNn0.3EAwEphZBq4x6b6IjGbRTa5NHdJGymiz0Lnu3875tIA';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GM_PASSWORD_KEY = 'sherlockgm_password';
const GM_SESSION_KEY = 'sherlockgm_session';

// localStorage may be blocked on file:// — fall back to in-memory store
const _memStore = {};
const store = {
  get: k => { try { return localStorage.getItem(k); } catch(e) { return _memStore[k] ?? null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { _memStore[k] = v; } },
  remove: k => { try { localStorage.removeItem(k); } catch(e) { delete _memStore[k]; } }
};

let currentCaseId = null;
let currentCaseName = null;
let currentCaseDescription = '';
let currentMapUrl = '';
let currentMapId = null;
let mapsLibrary = [];
let casesCache = [];

// ── LONDON DIRECTORY DATA ──
const LONDON_DIRECTORY = [{"name":"A.B. Cahn & Co","location":"20 E","category":null},{"name":"A.B. Muirhead","location":"41 EC","category":"Tea Merchants"},{"name":"A. Marx & Co","location":"36 SE","category":"Jewellers"},{"name":"A.W. Faber (stationer)","location":"29 EC","category":"Stationers"},{"name":"Aaron, Andrew","location":"1 E","category":null},{"name":"Abbot, Ruth","location":"38 NW","category":null},{"name":"Abbot, Walter","location":"38 NW","category":null},{"name":"Aberdeen Navigation Co","location":"26 EC","category":"Steamship Companies"},{"name":"Abernathy, Elmer","location":"86 SE","category":null},{"name":"Abernathy, Graham","location":"5 E","category":null},{"name":"Abrahams, O.L.D.","location":"75 SE","category":null},{"name":"Abramoff, Nicoli","location":"20 E","category":null},{"name":"Ackerman, L.","location":"5 SE","category":null},{"name":"Ackerman Printers","location":"12 E","category":null},{"name":"Acorn, Philibert","location":"30 E","category":null},{"name":"Acree, Joseph","location":"47 EC","category":null},{"name":"Adair, Hilda","location":"59 NW","category":null},{"name":"Adair, M.","location":"59 NW","category":null},{"name":"Adair, Ronald","location":"59 NW","category":null},{"name":"Adam, Sir Henry","location":"1 SW","category":null},{"name":"Adams, Harmon","location":"43 NW","category":null},{"name":"Adelaide-Southampton line","location":"15 E","category":null},{"name":"Admiralty, The","location":"10 SW","category":null},{"name":"Adrian, Adrian","location":"41 E","category":null},{"name":"Agar, Dr Moore","location":"43 NW","category":"Doctors"},{"name":"Aguirre, Carmen","location":"41 SW","category":null},{"name":"Ahern, Geraldine","location":"45 E","category":null},{"name":"Ahlstrom, Sven","location":"2 SE","category":null},{"name":"Ailes, Pauline","location":"58 E","category":null},{"name":"Ainstree, Dr A.","location":"24 NW","category":"Doctors"},{"name":"Ainsworth, Cyril","location":"57 SW","category":null},{"name":"Alaio, Rose","location":"53 WC","category":null},{"name":"Alari, Mehdi","location":"14 S","category":null},{"name":"Al-Bagee, Yahya","location":"7 SW","category":null},{"name":"Al-Saud, Abdullah","location":"19 SE","category":null},{"name":"Albany, Upton","location":"11 S","category":null},{"name":"Albee, Patrick","location":"42 E","category":null},{"name":"Alberga, Aurelius","location":"9 S","category":null},{"name":"Alberts, Norman","location":"20 S","category":null},{"name":"Albrecht, Hermann","location":"1 S","category":null},{"name":"Albrecht, Kurt","location":"65 E","category":null},{"name":"Albright, Rodelinda","location":"70 E","category":null},{"name":"Albritton, Potsworth","location":"9 SW","category":null},{"name":"Alchorn, Corinne","location":"50 S","category":null},{"name":"Alclair, Jean","location":"40 SW","category":null},{"name":"Aldersgate Street Station","location":"43 EC","category":"Stations"},{"name":"Aldgate Station","location":"12 EC","category":"Stations"},{"name":"Aldrich, Thomas","location":"27 SE","category":null},{"name":"Aldridge, Hasper","location":"11 NW","category":null},{"name":"Aldritt, Pierce & Co","location":"41 S","category":null},{"name":"Aleck Bros","location":"14 S","category":null},{"name":"Alexander Ltd","location":"71 E","category":null},{"name":"Alexander, Thomas","location":"51 WC","category":null},{"name":"Alexich, Fedor","location":"35 S","category":null},{"name":"Alford & Co","location":"86 E","category":null},{"name":"Alfrey, Belle","location":"3 SE","category":null},{"name":"Alger, Jacob","location":"16 E","category":null},{"name":"Algert, Rumson","location":"15 S","category":null},{"name":"Alhambra Music Hall","location":"25 WC","category":"Music Halls"},{"name":"Alison’s","location":"14 SE","category":null},{"name":"Allard, Thaddeus","location":"57 SE","category":null},{"name":"Allardt, Hendrick","location":"3 S","category":null},{"name":"Allardyce’s","location":"52 NW","category":null},{"name":"Allegro Theatre","location":"94 WC","category":"Theatres"},{"name":"Allen, Courtney","location":"14 NW","category":null},{"name":"Allen, Richard","location":"1 WC","category":null},{"name":"Allgood, Johnny","location":"10 SE","category":null},{"name":"Allmond, Etta","location":"28 S","category":null},{"name":"Allsworth, Cosgrove","location":"4 SW","category":null},{"name":"Alms House","location":"20 E","category":"Settlement Houses"},{"name":"Alpert, Elaine","location":"81 EC","category":null},{"name":"Alpha Inn","location":"65 WC","category":"Inns"},{"name":"Alsup, Mandy","location":"1 SW","category":null},{"name":"Altemus Bros","location":"82 E","category":null},{"name":"Althaus, Derrick","location":"13 SE","category":null},{"name":"Alzofon, Evita","location":"6 S","category":null},{"name":"Amaral, Ida","location":"33 SE","category":null},{"name":"Amateur Athletic Association","location":"8 NW","category":"Sport (Association)"},{"name":"Amateur Mendicant Society","location":"50 SE","category":null},{"name":"Amber & Co","location":"35 WC","category":"Tobacconists"},{"name":"Amberg, Rollin","location":"17 S","category":null},{"name":"Amberley, Josiah","location":"40 WC","category":null},{"name":"Amberley, Melinda","location":"84 EC","category":null},{"name":"Amberson & Co","location":"2 E","category":null},{"name":"Ambinder, Henry","location":"27 EC","category":null},{"name":"Ambrecht & Co","location":"32 NW","category":"Chemists"},{"name":"Ambree, Joanne","location":"18 S","category":null},{"name":"Ambrose & Birwick","location":"45 E","category":null},{"name":"Amburn, Sissy","location":"16 SE","category":null},{"name":"American Embassy","location":"18 SW","category":"Hospitals"},{"name":"American Exchange","location":"16 WC","category":null},{"name":"Ames, Edwin","location":"17 SE","category":null},{"name":"Ames, Frederick","location":"48 NW","category":null},{"name":"Amey, Liza","location":"37 SE","category":null},{"name":"Ammar, David","location":"29 SW","category":null},{"name":"Amoral, Gina","location":"74 E","category":null},{"name":"Amsden, Michael","location":"31 S","category":null},{"name":"Anaker, Gus","location":"35 SE","category":null},{"name":"Anasoff, Spero","location":"79 E","category":null},{"name":"Anchor Pub","location":"23 E","category":"Public Houses"},{"name":"Anchor, Dick","location":"41 SE","category":null},{"name":"Andersen, Byron","location":"27 EC","category":null},{"name":"Andeu, Etienne","location":"60 SW","category":null},{"name":"Andrews, Lawrence","location":"1 EC","category":null},{"name":"Angel Pub","location":"75 E","category":"Public Houses"},{"name":"Angel & Crown Inn","location":"82 E","category":"Inns"},{"name":"Angel, Hosmer","location":"7 SE","category":null},{"name":"Angel, Robert","location":"49 SW","category":null},{"name":"Angelini, Giacomo","location":"28 E","category":null},{"name":"Anglo-Indian Club","location":"67 WC","category":"Clubs"},{"name":"Anolik, Casper","location":"84 E","category":null},{"name":"Ansari, M.A.","location":"4 NW","category":null},{"name":"Anselmo, Lazo","location":"45 S","category":null},{"name":"Anspach, Willard","location":"58 SE","category":null},{"name":"Apollo Theatre","location":"19 NW","category":"Theatres"},{"name":"Appenrodt’s German Restaurant","location":"16 EC","category":"Restaurants"},{"name":"Appleby, Sam","location":"66 SE","category":null},{"name":"Aragon, Jose","location":"6 SE","category":null},{"name":"Arbegast, Paul","location":"71 SE","category":null},{"name":"Arbuckle, Paddy","location":"15 NW","category":null},{"name":"Archbishop’s Park","location":"90 SE","category":"Parks"},{"name":"Arctic Fur Store","location":"68 WC","category":"Furriers"},{"name":"Arden, Kenneth","location":"41 WC","category":null},{"name":"Ardvark, Artemus","location":"61 SE","category":null},{"name":"Arellano, Rudolpho","location":"34 E","category":null},{"name":"Arlington House","location":"42 E","category":"Settlement Houses"},{"name":"Armbuster, Ashley","location":"9 NW","category":null},{"name":"Armitage, Charles","location":"47 NW","category":null},{"name":"Armitage, Joseph","location":"41 SW","category":null},{"name":"Armitage’s Gallery","location":"21 NW","category":"Auction Houses"},{"name":"Armstead, Gen. Farsworth","location":"27 NW","category":null},{"name":"Army & Navy Store","location":"29 EC","category":null},{"name":"Arnesson, T.","location":"7 NW","category":null},{"name":"Arnold, Benson","location":"53 EC","category":null},{"name":"Arteberry, Phineas","location":"18 SW","category":null},{"name":"Artson, Beata","location":"21 SW","category":null},{"name":"Ash, Ephie","location":"75 SE","category":null},{"name":"Ashburn, Charles","location":"61 SW","category":null},{"name":"Aspic, Jonathan","location":"79 EC","category":null},{"name":"Asquith, H.","location":"4 EC","category":null},{"name":"Atkinson, Harry","location":"12 SE","category":null},{"name":"Aton, Unis","location":"89 E","category":null},{"name":"Atson, Peter","location":"45 WC","category":null},{"name":"Attard, Charles","location":"12 WC","category":"Barristers"},{"name":"Aubry, Wilson","location":"54 EC","category":null},{"name":"Auckland, Sir Herbert","location":"62 SW","category":null},{"name":"Aylward, Philip","location":"55 SW","category":null},{"name":"Bachmann, Rolph","location":"83 SE","category":null},{"name":"Bacmeister, Ernst","location":"5 EC","category":null},{"name":"Bacon & Co","location":"20 WC","category":"Map Sellers"},{"name":"Baedeker’s Excursions","location":"54 WC","category":null},{"name":"Bagatelle Card Club","location":"14 NW","category":"Clubs"},{"name":"Bagby, Riff","location":"65 SE","category":null},{"name":"Bagley, Ronda","location":"80 SE","category":null},{"name":"Bagnell, Fergus","location":"39 S","category":null},{"name":"Bagnell, Georgina","location":"13 S","category":null},{"name":"Bailey, Francis","location":"43 NW","category":null},{"name":"Baily, Joanna","location":"18 EC","category":null},{"name":"Bain, Sandy","location":"54 WC","category":null},{"name":"Baines, William","location":"64 SE","category":null},{"name":"Baird, Jane","location":"83 EC","category":null},{"name":"Bake, Floyd","location":"26 S","category":null},{"name":"Baker, Ellis","location":"49 SW","category":null},{"name":"Baker, Roger","location":"50 SW","category":null},{"name":"Bakersfield, Woodward","location":"6 NW","category":"Barristers"},{"name":"Baker’s Row Asylum","location":"34 E","category":"Settlement Houses"},{"name":"Balderree, Clayton","location":"24 SE","category":null},{"name":"Baldrige, W.","location":"51 WC","category":null},{"name":"Baldwin & Furth","location":"22 S","category":null},{"name":"Baldwin Card Club","location":"88 SW","category":"Clubs"},{"name":"Balfour, M.","location":"50 SW","category":null},{"name":"Balladone, Emilio","location":"50 S","category":null},{"name":"Ballard, Eve","location":"20 S","category":null},{"name":"Ballard, P.B.","location":"97 EC","category":null},{"name":"Balmoral, Lord","location":"1 SW","category":null},{"name":"Baltrip & Castle","location":"27 E","category":null},{"name":"Bancroft, De Witt","location":"20 SW","category":null},{"name":"Banducci & Sons","location":"17 E","category":null},{"name":"Bank of England","location":"23 EC","category":"Banks"},{"name":"Banks, James","location":"7 SW","category":null},{"name":"Bannerjee, Mohandas","location":"48 NW","category":null},{"name":"Bannister, Ward","location":"4 S","category":null},{"name":"Bansmer, Horst","location":"16 S","category":null},{"name":"Bar of Gold Pub","location":"33 SE","category":"Public Houses"},{"name":"Barbour, Regina","location":"59 SE","category":null},{"name":"Barfield, Obee","location":"17 NW","category":null},{"name":"Barford & Criswell","location":"39 E","category":null},{"name":"Barkell, Trudy","location":"41 SE","category":null},{"name":"Barker, George","location":"22 SE","category":null},{"name":"Barker’s Detective Agency","location":"66 WC","category":"Detective Agencies"},{"name":"Barksdale, Frederick","location":"15 SW","category":null},{"name":"Barnard, Seth","location":"30 E","category":null},{"name":"Barnett, Joseph","location":"25 EC","category":null},{"name":"Barnett, Richard","location":"1 SE","category":null},{"name":"Barnicot, Dr S.","location":"58 WC","category":null},{"name":"Baron, Sid","location":"43 S","category":null},{"name":"Baroni, Stephano","location":"32 E","category":null},{"name":"Barraud & Lunds","location":"16 EC","category":"Watchmakers"},{"name":"Barret, Deborah","location":"2 E","category":null},{"name":"Barret, Michael","location":"8 SE","category":null},{"name":"Barrow, Marsha","location":"7 WC","category":null},{"name":"Barstad, Susan","location":"68 SE","category":null},{"name":"Barton, Inspector","location":"51 SE","category":null},{"name":"Bashford, John","location":"13 S","category":null},{"name":"Baskind, Edward","location":"60 SW","category":null},{"name":"Bataglini, Cicero","location":"18 E","category":null},{"name":"Bateman, S.","location":"1 NW","category":null},{"name":"Baterman, Leah","location":"42 S","category":null},{"name":"Bates, Lucy","location":"6 E","category":null},{"name":"Batik, Vera","location":"13 E","category":null},{"name":"Battersby, Abner","location":"18 S","category":null},{"name":"Battino, Giovanni","location":"29 E","category":null},{"name":"Baumgartner, Rachel","location":"19 E","category":null},{"name":"Baxter, Edith","location":"67 SE","category":null},{"name":"Baxter, Lillian","location":"31 SE","category":null},{"name":"Bayard, Charles","location":"1 E","category":null},{"name":"Bayliss Cycles","location":"92 EC","category":"Cycles"},{"name":"Bayol, Clotilda","location":"25 SW","category":null},{"name":"Beaudouin, Constance","location":"26 SW","category":null},{"name":"Beaufort House","location":"7 NW","category":"Chemists"},{"name":"Beaufort, Harrison","location":"82 SE","category":"Dentists"},{"name":"Beaupre, Ambroise","location":"52 SW","category":null},{"name":"Becker, Dennis","location":"10 E","category":null},{"name":"Becker, Matthew","location":"56 SW","category":null},{"name":"Beckwith, Lawrence","location":"57 SE","category":null},{"name":"Beddington, A.","location":"78 SE","category":null},{"name":"Beddington, H.","location":"74 SE","category":null},{"name":"Bedford Women’s College","location":"44 NW","category":null},{"name":"Bedinaric, Charles","location":"85 SE","category":null},{"name":"Beedle & Smith, Ltd","location":"13 E","category":null},{"name":"Beemer, Arthur","location":"3 E","category":null},{"name":"Belanger, Nora","location":"20 E","category":null},{"name":"Bell’s Baths","location":"11 EC","category":"Charities"},{"name":"Bell, Dean","location":"39 SE","category":null},{"name":"Bellamy, Maud","location":"49 NW","category":null},{"name":"Bellamy, William","location":"49 NW","category":null},{"name":"Bellinger, Lord","location":"1 SW","category":null},{"name":"Belminster, Duke of","location":"68 SW","category":null},{"name":"Belton, Franck","location":"14 E","category":null},{"name":"Benares Metal Works","location":"87 SE","category":null},{"name":"Benedict, Sir Julius","location":"27 NW","category":null},{"name":"Benjamin, Asa","location":"37 S","category":null},{"name":"Bennet, Jeremy","location":"27 SE","category":null},{"name":"Bentley’s Private Hotel","location":"32 WC","category":"Hotels"},{"name":"Bentley, Lynn","location":"17 E","category":null},{"name":"Beresford, Tipton","location":"25 E","category":null},{"name":"Bergman & Berkowitz","location":"88 E","category":null},{"name":"Berisov, Dimitri","location":"25 E","category":null},{"name":"Bernet, Antoine","location":"39 E","category":null},{"name":"Bernhardt, Sarah","location":"3 SW","category":null},{"name":"Berntein, Caleb","location":"7 S","category":null},{"name":"Bertain, Lucille","location":"25 S","category":null},{"name":"Bertero, Adriano","location":"1 S","category":null},{"name":"Bestianelli, Dr","location":"50 EC","category":"Doctors"},{"name":"Bethlehem Lunatic Asylum","location":"28 SE","category":null},{"name":"Bettencourt, Graham","location":"69 SE","category":null},{"name":"Betteredge, Peter","location":"53 SW","category":null},{"name":"Bexton, Wooster & Sons","location":"3 S","category":null},{"name":"Bhave, Vinoba","location":"56 EC","category":null},{"name":"Bickel, Sharon","location":"27 E","category":null},{"name":"Bickers & Sons","location":"7 SW","category":null},{"name":"Biderman, Jotham","location":"2 S","category":null},{"name":"Bigelow, Byron","location":"19 NW","category":null},{"name":"Billson & Tromp","location":"89 E","category":null},{"name":"Billy","location":"52 NW","category":null},{"name":"Birch, Lucy","location":"79 SE","category":null},{"name":"Birnbaum, Ebenezer","location":"45 S","category":null},{"name":"Bishop’s Finger Inn","location":"18 EC","category":"Inns"},{"name":"Black Crown Inn","location":"88 EC","category":"Inns"},{"name":"Black Swan Inn","location":"25 E","category":"Inns"},{"name":"Blake, Juliana","location":"14 SE","category":null},{"name":"Blake, Ned","location":"14 SE","category":null},{"name":"Bloggs Line","location":"25 E","category":"Steamship Companies"},{"name":"Bloogs, Algernon","location":"42 SW","category":null},{"name":"Bloogs, Cuthbert","location":"49 SW","category":null},{"name":"Blue Ball Inn","location":"50 E","category":"Inns"},{"name":"Blue, Violette","location":"49 EC","category":null},{"name":"Blumberg, Esther","location":"32 S","category":null},{"name":"Boissiere, Gilbert","location":"19 NW","category":null},{"name":"Boland, Denny","location":"16 NW","category":null},{"name":"Bolton, Willie","location":"72 SE","category":null},{"name":"Bon Marché","location":"81 NW","category":"Department Stores"},{"name":"Bonds & Honds","location":"16 NW","category":"Tobacconists"},{"name":"Bonham’s","location":"12 NW","category":"Auction Houses"},{"name":"Boone, Hugh","location":"21 EC","category":null},{"name":"Boosey & Co","location":"4 WC","category":null},{"name":"Boothe, Simon","location":"55 WC","category":null},{"name":"Borough, The","location":"86 SE","category":"Chemists"},{"name":"Bow Station","location":"101 E","category":"Stations"},{"name":"Bow Street Police Station","location":"70 WC","category":"Police Stations"},{"name":"Bowen, Kildare","location":"38 SW","category":null},{"name":"Bradley’s","location":"54 NW","category":"Tobacconists"},{"name":"Bradley, Sherman","location":"14 NW","category":null},{"name":"Bradstreet, Inspector","location":"50 NW","category":null},{"name":"Brandon, Sir Miller","location":"51 NW","category":null},{"name":"Brenckenridge, M.","location":"56 WC","category":null},{"name":"Brickfall & Amberley","location":"79 WC","category":null},{"name":"Bridge House Hotel","location":"3 SE","category":"Hotels"},{"name":"Brietkopf & Haertel","location":"5 SE","category":null},{"name":"Briggs, S.","location":"52 NW","category":null},{"name":"Britannia Inn","location":"87 EC","category":"Inns"},{"name":"British Museum","location":"38 WC","category":"Pawnbrokers"},{"name":"British Museum Library","location":"38 WC","category":"Pawnbrokers"},{"name":"Broderick & Nelson","location":"2 WC","category":null},{"name":"Brokstein, Murray","location":"46 S","category":null},{"name":"Brooke, Stella","location":"58 WC","category":null},{"name":"Brougham, Hale","location":"69 SW","category":null},{"name":"Broussard, Louis","location":"15 E","category":null},{"name":"Brown, Dr F. G.","location":"81 EC","category":"Doctors"},{"name":"Brown, Inspector","location":"50 WC","category":null},{"name":"Brown, James","location":"11 E","category":null},{"name":"Brown, Sam","location":"40 NW","category":null},{"name":"Browne, Katharine","location":"15 NW","category":null},{"name":"Browne, Walter","location":"40 SW","category":null},{"name":"Bruce, Henry Brudenell","location":"46 SW","category":null},{"name":"Bruce-Partington, A.","location":"2 NW","category":null},{"name":"Bruff, Cuthbert","location":"81 EC","category":null},{"name":"Bryant, Matthew","location":"29 EC","category":null},{"name":"Buchanan, J.","location":"3 WC","category":null},{"name":"Buckingham Palace","location":"35 SW","category":"Parks"},{"name":"Buckingham Palace Gardens","location":"96 SW","category":"Parks"},{"name":"Burham, John","location":"43 SE","category":null},{"name":"Burham, Sally","location":"53 SW","category":null},{"name":"Burke, James","location":"94 NW","category":null},{"name":"Burns, Stephen","location":"44 WC","category":null},{"name":"Burnwell, Sir George","location":"46 SW","category":null},{"name":"Buszard’s Tea Room","location":"84 NW","category":"Tea Rooms"},{"name":"Buxton, Philip","location":"6 NW","category":null},{"name":"C. Smith & Sons","location":"67 EC","category":"Map Sellers"},{"name":"Cabot, Carson","location":"53 SW","category":null},{"name":"Cadbury Bros Cocoa","location":"76 SE","category":"Cocoa Manufacturers"},{"name":"Cade, Longfellow","location":"96 EC","category":null},{"name":"Cadmer, Elisabeth","location":"82 EC","category":null},{"name":"Cadosh, Albert","location":"27 E","category":null},{"name":"Cadwell, Samuel","location":"63 SW","category":null},{"name":"Cafe Monico","location":"90 NW","category":"Restaurants"},{"name":"Cafe Royal","location":"82 NW","category":"Restaurants"},{"name":"Cairns, Patrick","location":"17 E","category":null},{"name":"Calder, Maxine","location":"49 EC","category":null},{"name":"Calendar, Maria","location":"54 NW","category":null},{"name":"Callison, Nancy","location":"85 EC","category":null},{"name":"Calvin House","location":"7 E","category":"Chemists"},{"name":"Camden House","location":"53 NW","category":null},{"name":"Cameron, Mark","location":"44 EC","category":null},{"name":"Cameron, Veronica","location":"88 EC","category":null},{"name":"Cammark, Waldo","location":"58 SW","category":null},{"name":"Camp, Richard","location":"23 NW","category":null},{"name":"Canaday, Calvern","location":"71 SW","category":null},{"name":"Canetti, Gabriel","location":"4 S","category":null},{"name":"Cantlemere, Lord","location":"55 SW","category":null},{"name":"Cantor, Daniel","location":"44 S","category":null},{"name":"Capellino, Antonio","location":"5 S","category":null},{"name":"Capital & Counties Bank","location":"75 NW","category":"Banks"},{"name":"Caplan, Jeremiah","location":"35 S","category":null},{"name":"Carbone & Co","location":"8 S","category":null},{"name":"Cardiff, Gregory","location":"50 SW","category":null},{"name":"Cardinal & Hartford","location":"11 WC","category":"Carpets"},{"name":"Cardinelli, Homero","location":"79 E","category":null},{"name":"Cardus, Neville","location":"40 NW","category":null},{"name":"Cardwell, Bart","location":"15 NW","category":null},{"name":"Carere, Semone","location":"54 EC","category":null},{"name":"Carey, Patricia","location":"29 NW","category":null},{"name":"Carina","location":"73 WC","category":null},{"name":"Carleton, Lloyd","location":"42 SW","category":null},{"name":"Carleton Club","location":"7 SW","category":"Clubs"},{"name":"Carley, Chester","location":"8 SE","category":null},{"name":"Carlin Tobacco","location":"7 SW","category":"Tobacconists"},{"name":"Carlisle, John","location":"71 SW","category":null},{"name":"Carlstad, Nick","location":"23 S","category":null},{"name":"Carmack, Gene","location":"21 EC","category":null},{"name":"Carmody, Roy","location":"45 E","category":null},{"name":"Caro, Elaine","location":"57 EC","category":null},{"name":"Carpenter, Sylvia","location":"27 SE","category":null},{"name":"Carr, Sarah","location":"95 EC","category":null},{"name":"Carr, William","location":"95 EC","category":null},{"name":"Carrel, Milly","location":"40 S","category":null},{"name":"Carrington & Co","location":"33 WC","category":"Jewellers"},{"name":"Carroll, Alice","location":"46 WC","category":null},{"name":"Carroll, Lewis","location":"55 NW","category":null},{"name":"Carruthers, Colonel","location":"40 EC","category":null},{"name":"Cartan, James","location":"60 WC","category":null},{"name":"Carter, Eliza","location":"36 SE","category":null},{"name":"Cartwright, Able","location":"79 SE","category":null},{"name":"Cartwright, Ben","location":"6 NW","category":null},{"name":"Cartwright, Fay","location":"32 NW","category":null},{"name":"Cartwright, Thomas","location":"61 WC","category":null},{"name":"Cartwright, Whitney","location":"32 NW","category":"Solicitors"},{"name":"Carvalho, Maria de","location":"58 EC","category":null},{"name":"Carver, George W.","location":"40 SE","category":null},{"name":"Case, Herbert","location":"94 EC","category":null},{"name":"Casey, S.","location":"9 WC","category":null},{"name":"Cassel, Fred","location":"44 SE","category":null},{"name":"Casselman & Co","location":"52 E","category":null},{"name":"Castain, Ronda","location":"20 NW","category":null},{"name":"Castleberry & Pomfrey","location":"45 S","category":null},{"name":"Catlin, Dick","location":"16 S","category":null},{"name":"Catton, Brice","location":"36 S","category":null},{"name":"Cavalli, Rosalba","location":"12 S","category":null},{"name":"Cavendish Club","location":"25 NW","category":"Clubs"},{"name":"Caverly, Meg","location":"1 S","category":null},{"name":"Cavill, Minnie","location":"11 SE","category":null},{"name":"Caxton, Lee","location":"15 SE","category":null},{"name":"Caywood, Dunston","location":"22 NW","category":null},{"name":"Central Carriage Stables","location":"5 WC","category":"Stables"},{"name":"Central News Agency","location":"63 EC","category":"Pawnbrokers"},{"name":"Central Press Syndicate","location":"25 EC","category":"Prisons"},{"name":"Cernac, Claude","location":"69 SW","category":null},{"name":"Cevallos, Anita","location":"7 S","category":null},{"name":"Chabot, Adrian","location":"82 E","category":null},{"name":"Chadbourne, Jeffrey","location":"21 S","category":null},{"name":"Chaffe, Maria","location":"62 WC","category":null},{"name":"Chalmers, Alice","location":"67 SW","category":null},{"name":"Chambers, Ralph","location":"8 WC","category":null},{"name":"Chan, Charles","location":"56 NW","category":null},{"name":"Chandos, Sir Charles","location":"64 SW","category":null},{"name":"Chapman, Roger","location":"29 WC","category":null},{"name":"Chappel, Andre","location":"32 NW","category":null},{"name":"Chardon, Louis","location":"80 SE","category":null},{"name":"Charing Cross Hospital","location":"91 WC","category":"Hospitals"},{"name":"Charing Cross Hotel","location":"90 WC","category":"Hotels"},{"name":"Charing Cross Station","location":"21 WC","category":"Stations"},{"name":"Charles Frodsham & Co","location":"38 NW","category":"Watchmakers"},{"name":"Charpentier, Alice","location":"59 SE","category":null},{"name":"Charpentier, Arthur","location":"59 SE","category":null},{"name":"Charpentier, M.","location":"59 SE","category":null},{"name":"Charter House","location":"45 EC","category":null},{"name":"Chaudet, Gaspar","location":"30 NW","category":null},{"name":"Chelsea Baths","location":"29 SW","category":"Charities"},{"name":"Chelsea Hospital","location":"45 SW","category":"Hospitals"},{"name":"Chester, Mudd & Sons","location":"65 E","category":null},{"name":"Childess, R.","location":"59 EC","category":null},{"name":"China Legation","location":"38 NW","category":"Hospitals"},{"name":"Christie’s","location":"87 SW","category":"Auction Houses"},{"name":"Cisneros, Maria","location":"28 E","category":null},{"name":"City & Suburban Bank","location":"72 EC","category":"Banks"},{"name":"Clack, Hilda","location":"52 SW","category":null},{"name":"Clapp, Nina","location":"10 E","category":null},{"name":"Clarendon, Guy","location":"31 SW","category":null},{"name":"Clarendon, Lady Gertrude","location":"31 SW","category":null},{"name":"Clarendon, Sir Francis","location":"31 SW","category":null},{"name":"Claridge Hotel","location":"30 NW","category":"Hotels"},{"name":"Clay, John","location":"46 EC","category":null},{"name":"Clement, Maris","location":"40 S","category":null},{"name":"Clepper, Agnes","location":"63 SW","category":null},{"name":"Cloyd, John","location":"25 NW","category":null},{"name":"Cobay’s","location":"6 NW","category":"Department Stores"},{"name":"Cobbet, Wenworth","location":"7 NW","category":null},{"name":"Cobham, L.","location":"63 WC","category":null},{"name":"Coborn Road Station","location":"100 E","category":"Stations"},{"name":"Cockrell, James","location":"5 S","category":null},{"name":"Coddington, Jim","location":"22 E","category":null},{"name":"Cody, Scott","location":"18 E","category":null},{"name":"Coffrey, Eddy","location":"18 E","category":null},{"name":"Cohen, Abraham","location":"57 E","category":null},{"name":"Cohen, Martha","location":"57 E","category":null},{"name":"Coin, Gertrude","location":"86 SE","category":null},{"name":"Coker, Harney","location":"19 S","category":null},{"name":"Cole, Matthew","location":"11 SE","category":null},{"name":"Cole, Sir Henry","location":"77 EC","category":null},{"name":"Colombo, Philip","location":"26 E","category":null},{"name":"Colonial Institute","location":"86 SW","category":"Pawnbrokers"},{"name":"Colonial Office","location":"91 SW","category":"Government Offices"},{"name":"Colt’s Firearms Co","location":"12 NW","category":"Gunsmiths"},{"name":"Commercial Docks","location":"66 S","category":"Docks"},{"name":"Commercial Gas Works","location":"51 E","category":null},{"name":"Commercial St. Police Station","location":"100 EC","category":null},{"name":"Co. Gen. Transatlantique","location":"27 S","category":"Steamship Companies"},{"name":"Compton, Sylvester","location":"35 NW","category":null},{"name":"Comstock, Clayton","location":"51 SW","category":null},{"name":"Confer, Janet","location":"55 SW","category":null},{"name":"Continental Bank","location":"68 WC","category":"Banks"},{"name":"Continental Gazetteer","location":"69 WC","category":null},{"name":"Continental Wire Service","location":"87 NW","category":null},{"name":"Conway, Thomas","location":"50 SE","category":null},{"name":"Cook, T. Failor","location":"4 WC","category":null},{"name":"Cook’s Billiard Room","location":"8 SW","category":null},{"name":"Copple, Berney","location":"52 S","category":null},{"name":"Corbett, Andrew","location":"9 S","category":null},{"name":"Corbett, Lil","location":"39 S","category":null},{"name":"Corbyn, Stacey & Co","location":"48 EC","category":null},{"name":"Coroner","location":"91 EC","category":"Coroner’s Office"},{"name":"Corrigan, Sean","location":"37 NW","category":null},{"name":"Corson & Filch","location":"56 E","category":null},{"name":"Cosgrove, Homer","location":"24 NW","category":null},{"name":"Cosmopolitan Hotel","location":"71 SW","category":"Hotels"},{"name":"Covent Garden Market","location":"28 WC","category":"Markets"},{"name":"Covent Garden Theatre","location":"30 WC","category":"Theatres"},{"name":"Cowper, Edward","location":"100 SW","category":null},{"name":"Cox & Co Bank","location":"22 WC","category":"Banks"},{"name":"Crabb, Jack","location":"36 NW","category":null},{"name":"Crabtree, Cyrus","location":"55 E","category":null},{"name":"Crain, Ellie","location":"47 E","category":null},{"name":"Cranmer, T.","location":"21 EC","category":null},{"name":"Credit Lyonnais","location":"60 SW","category":null},{"name":"Crenshaw, Verlon","location":"56 E","category":null},{"name":"Cressman, Hannah","location":"14 E","category":null},{"name":"Criminal Court","location":"36 EC","category":null},{"name":"Criminal Investigation","location":"13 SW","category":"Scotland Yard"},{"name":"Criminology Laboratory","location":"22 SW","category":"Scotland Yard"},{"name":"Cristobol, Veronica","location":"43 E","category":null},{"name":"Criterion Club","location":"3 SW","category":"Clubs"},{"name":"Crocker, Harrisson","location":"59 E","category":null},{"name":"Crofton, Riply","location":"38 NW","category":null},{"name":"Croquet Association","location":"41 SW","category":"Sport (Association)"},{"name":"Crossingham’s Lodging House","location":"35 E","category":"Chemists"},{"name":"Crowe & Rowell","location":"74 E","category":null},{"name":"Crown Swimming Baths","location":"20 SE","category":"Charities"},{"name":"Crown Inn","location":"83 NW","category":"Inns"},{"name":"Crowther, Michael","location":"3 E","category":null},{"name":"Cruden, Denise","location":"60 E","category":null},{"name":"Cubitt, Sir William","location":"100 SW","category":null},{"name":"Culinane, Kitty","location":"69 SW","category":null},{"name":"Culpepper, Waldo","location":"44 NW","category":null},{"name":"Cummins & Goins","location":"6 SE","category":null},{"name":"Cunard Line Office","location":"83 EC","category":"Steamship Companies"},{"name":"Cunnigham, Charles","location":"57 NW","category":"Solicitors"},{"name":"Cushing, P.","location":"60 EC","category":null},{"name":"Customs House","location":"19 EC","category":null},{"name":"Cutter, Jake","location":"84 E","category":null},{"name":"Cyclists’ Touring Club","location":"75 EC","category":"Sport (Association)"},{"name":"Da Silva, Timoteo","location":"44 E","category":null},{"name":"Dabit, Esam","location":"45 SE","category":null},{"name":"Dachauer, Rodney","location":"47 EC","category":null},{"name":"Dacre Hotel","location":"62 EC","category":"Hotels"},{"name":"Dagget, Alice","location":"48 E","category":null},{"name":"Dagget, Casey","location":"48 E","category":null},{"name":"Dagit, Philip","location":"53 WC","category":"Solicitors"},{"name":"Dagneau, Andre","location":"58 NW","category":null},{"name":"Dahl, Antoine","location":"50 WC","category":null},{"name":"Dahlin, Una","location":"68 SW","category":null},{"name":"Dailey, Baker","location":"2 EC","category":null},{"name":"Daily Chronicle","location":"64 EC","category":"Prisons"},{"name":"Daily Gazette","location":"74 WC","category":"Prisons"},{"name":"Daily News","location":"71 SE","category":"Prisons"},{"name":"Daily Telegraph","location":"88 NW","category":"Prisons"},{"name":"Dain, Irene","location":"59 WC","category":null},{"name":"Dair, Virginia","location":"64 SW","category":null},{"name":"Dakin & Co","location":"94 EC","category":"Tea Merchants"},{"name":"Dalbak, Kurt","location":"69 E","category":null},{"name":"D’Albert, Count","location":"60 NW","category":null},{"name":"D’Albert, Countess","location":"60 NW","category":null},{"name":"Dale, E.","location":"64 WC","category":null},{"name":"Dallmeyer & Callahan","location":"40 SW","category":null},{"name":"Dallow, Mary","location":"45 NW","category":null},{"name":"Dally, Salvatore","location":"92 EC","category":null},{"name":"Dalrymple, Randolph","location":"80 NW","category":null},{"name":"D’Ambrosio, Antonio","location":"45 NW","category":null},{"name":"Damery, Sir James","location":"42 WC","category":null},{"name":"Dancel, Amy","location":"71 SW","category":null},{"name":"Dannenberg, Hiram","location":"11 S","category":null},{"name":"Danridge, Erwin","location":"78 EC","category":null},{"name":"Dant, Lionel","location":"40 EC","category":null},{"name":"Danziger, Wilie","location":"49 E","category":null},{"name":"Darbee, Walter","location":"50 E","category":null},{"name":"Darby, Michael","location":"47 E","category":null},{"name":"Darden, Lolly","location":"60 E","category":null},{"name":"Darold, Anna","location":"90 EC","category":null},{"name":"Darte, Sir Wystan","location":"56 SW","category":null},{"name":"Dauber & Dons","location":"25 E","category":null},{"name":"Davenport, Chandler","location":"28 WC","category":null},{"name":"Davenport, Hiram","location":"1 NW","category":"Solicitors"},{"name":"Davenport, J.","location":"4 WC","category":null},{"name":"Davids, Arthur","location":"46 SE","category":null},{"name":"Davids, S.","location":"42 SW","category":null},{"name":"Davidson, Lloyd","location":"13 NW","category":null},{"name":"Dawkins, Jemmy","location":"27 S","category":null},{"name":"De Keyser’s Royal Hotel","location":"31 EC","category":"Hotels"},{"name":"De Laurier, Clement","location":"75 SW","category":null},{"name":"De Vries Diamonds","location":"34 SW","category":"Jewellers"},{"name":"Dean, Melodellen","location":"62 E","category":null},{"name":"Dearth, Bessie","location":"25 SW","category":null},{"name":"Deaton, Aloysius","location":"61 SW","category":null},{"name":"Debenham & Freebody","location":"34 NW","category":"Furriers"},{"name":"Dechant, Victor","location":"51 EC","category":null},{"name":"Deckbar, Adrian","location":"24 SE","category":null},{"name":"Deerman, John","location":"81 SE","category":null},{"name":"Deetz, Edgar","location":"40 S","category":null},{"name":"Dekker, Emmett","location":"20 WC","category":null},{"name":"Del Guerra, Hector","location":"36 WC","category":null},{"name":"Delancy & Street","location":"43 E","category":null},{"name":"Delphine, Marguerite","location":"11 NW","category":null},{"name":"Denham, Lord Astley","location":"27 NW","category":null},{"name":"Dent & Sons Co","location":"67 WC","category":null},{"name":"Denton, Alice","location":"59 SW","category":null},{"name":"Denton, John","location":"59 SW","category":null},{"name":"Denton, Sir William","location":"100 SW","category":null},{"name":"DeNunzio, H.","location":"3 SW","category":null},{"name":"Deptford Park","location":"62 S","category":"Parks"},{"name":"Deptford Road Station","location":"67 S","category":"Stations"},{"name":"Derbin, Albert","location":"15 SE","category":null},{"name":"Derbin, Christopher","location":"61 EC","category":null},{"name":"Derbin, Penelope","location":"15 SE","category":null},{"name":"Derby, Lord","location":"100 SW","category":null},{"name":"Derrick, Vincent","location":"90 EC","category":null},{"name":"DeVecchio, Dominic","location":"15 E","category":null},{"name":"Devendorf, Heinz","location":"83 NW","category":null},{"name":"Devine, Andrew","location":"2 WC","category":null},{"name":"Devoe, Hacken","location":"22 S","category":null},{"name":"Dew, Walter","location":"1 SE","category":null},{"name":"Dexheimer, Ezra","location":"39 S","category":null},{"name":"Dhami, Harish","location":"5 S","category":null},{"name":"Diaz, Hermosa","location":"32 S","category":null},{"name":"Dickers’","location":"86 SW","category":"Tobacconists"},{"name":"Dickert, Daniel","location":"88 NW","category":null},{"name":"Dickey, Gordon","location":"41 NW","category":null},{"name":"Diebold, Celeste","location":"59 E","category":null},{"name":"Diehl, Fair","location":"10 WC","category":null},{"name":"Dietmeyer, Malachi","location":"41 S","category":null},{"name":"Diggs, Harold","location":"8 WC","category":"Solicitors"},{"name":"Dimsdale, Clara","location":"82 SE","category":null},{"name":"Dint, Allcroft & Co","location":"25 EC","category":null},{"name":"Dinwiddie, Crutcher","location":"18 WC","category":null},{"name":"Diogenes Club","location":"8 SW","category":"Clubs"},{"name":"Diradoni, Agostino","location":"13 S","category":null},{"name":"Dirge & Dirge","location":"69 WC","category":null},{"name":"Dirk, Stephen","location":"11 SE","category":null},{"name":"Diskin, Sybil","location":"19 S","category":null},{"name":"Disraeli, Benjamin","location":"14 SW","category":null},{"name":"Diwon, Evangeline","location":"41 NW","category":null},{"name":"Dobbs, Diane","location":"52 E","category":null},{"name":"Dobbs, Jay","location":"52 E","category":null},{"name":"Dobell Books","location":"66 WC","category":"Booksellers (used & rare)"},{"name":"Dockey, Houton","location":"25 S","category":null},{"name":"Dodd, James M.","location":"3 NW","category":null},{"name":"Dodson, Gary","location":"65 E","category":null},{"name":"Dodson, Roy","location":"48 EC","category":null},{"name":"Dodwell, H.M.","location":"47 SE","category":null},{"name":"Dolamore & Co","location":"36 SE","category":"Wine Merchants"},{"name":"Dolin, Thomas","location":"46 NW","category":null},{"name":"Dols, Herbert","location":"19 WC","category":null},{"name":"Dombrowski, Sasha","location":"21 SE","category":null},{"name":"Dominguez, Ines","location":"80 NW","category":null},{"name":"Dominion Line","location":"71 E","category":"Steamship Companies"},{"name":"Donald, Hoolahan & Co","location":"54 E","category":null},{"name":"Donohue, James","location":"63 EC","category":null},{"name":"Donottoo, Tommaso","location":"33 E","category":null},{"name":"Donovan, Timothy","location":"35 E","category":null},{"name":"Doolitle, Clifford","location":"22 WC","category":null},{"name":"Dorak, A.","location":"20 SE","category":null},{"name":"Dorfman, Benjamin","location":"48 S","category":null},{"name":"Dorking, Colonel","location":"3 NW","category":null},{"name":"Dornfeld, Jeremiah","location":"64 E","category":null},{"name":"Dornin, Clive","location":"34 NW","category":null},{"name":"Dornin, Hais","location":"60 NW","category":null},{"name":"Dottin, Able Rouse","location":"100 SW","category":null},{"name":"Doty, Eric","location":"19 SE","category":null},{"name":"Dover Rooms","location":"11 SE","category":"Chemists"},{"name":"Dowd, Elwood P.","location":"67 WC","category":null},{"name":"Downey, Lee","location":"23 WC","category":null},{"name":"Drabik, Elizabeth","location":"21 S","category":null},{"name":"Drage, Wilbur","location":"31 WC","category":null},{"name":"Dratt, Maude","location":"18 SE","category":null},{"name":"Drew, Thomas","location":"134 E","category":null},{"name":"Driscoll, Jared","location":"10 EC","category":null},{"name":"Driver’s Oyster Bar","location":"72 WC","category":"Restaurants"},{"name":"Drummond’s Bank","location":"26 WC","category":"Banks"},{"name":"Drury Lane Theatre","location":"31 WC","category":"Theatres"},{"name":"Duckett & Co","location":"27 EC","category":"Stationers"},{"name":"Dudley, Peter","location":"2 SE","category":null},{"name":"Dudoroff, Vasili","location":"89 EC","category":null},{"name":"Duffield, Eugene","location":"58 E","category":null},{"name":"Duggan, John","location":"48 SE","category":null},{"name":"Dumont, Delores","location":"42 WC","category":null},{"name":"Duncan, Bobby","location":"83 E","category":null},{"name":"Duncan, Sir W. C.","location":"100 SW","category":null},{"name":"Dunham, Tracy","location":"27 EC","category":null},{"name":"Dunsmir, Chaney","location":"82 NW","category":null},{"name":"Dunsworthy, Lady Rosanna","location":"43 SW","category":null},{"name":"Duong, Chen Han","location":"30 WC","category":null},{"name":"Dupuy, David","location":"71 E","category":null},{"name":"Durand, Jacques","location":"61 NW","category":null},{"name":"Durgin, Peter","location":"28 S","category":null},{"name":"Durkee, Tuttle","location":"24 WC","category":null},{"name":"Dutcher, Van","location":"30 WC","category":null},{"name":"Duttle, Rory","location":"25 WC","category":null},{"name":"Duval, Irene","location":"30 S","category":null},{"name":"Duxbury, Michael","location":"64 EC","category":null},{"name":"Dyson, Robby","location":"26 WC","category":null},{"name":"Dytch, Whilma","location":"48 SE","category":null},{"name":"E.M. Tuttle & Co","location":"60 S","category":null},{"name":"Eakin, Leroy","location":"20 SE","category":null},{"name":"Early, Warren","location":"4 EC","category":null},{"name":"Eason, Byers","location":"3 EC","category":null},{"name":"Eason, Tyler","location":"7 S","category":null},{"name":"East India Docks","location":"99 E","category":"Docks"},{"name":"Eastham, Netty","location":"54 E","category":null},{"name":"Eaton, Julius","location":"77 SE","category":null},{"name":"Ebert, Kingsley","location":"49 SE","category":null},{"name":"Ebner, Melvin","location":"47 S","category":null},{"name":"Eccles, John Scott","location":"92 NW","category":null},{"name":"Eckermann, A.","location":"2 WC","category":null},{"name":"Eckers, Maxwell","location":"88 EC","category":null},{"name":"Eckersley, Robert","location":"27 WC","category":null},{"name":"Eckstein, Eleasar","location":"38 S","category":null},{"name":"Eckstrom, Carl","location":"3 WC","category":null},{"name":"Eddington Ltd","location":"42 S","category":null},{"name":"Eddison & Lampley","location":"69 E","category":null},{"name":"Eddy, Collier","location":"2 SE","category":null},{"name":"Edelstein, Sidney","location":"34 S","category":null},{"name":"Edgerton, James","location":"84 WC","category":null},{"name":"Edgewood, Donald","location":"67 E","category":null},{"name":"Edison & Swan Electricity","location":"14 SE","category":null},{"name":"Edwards, Barbara","location":"34 NW","category":null},{"name":"Edwards, George","location":"100 SW","category":null},{"name":"Edwards, Marcy","location":"26 SE","category":null},{"name":"Edwards, Owen","location":"62 NW","category":null},{"name":"Egan, John","location":"47 NW","category":null},{"name":"Egelhoff, Ivan","location":"2 S","category":null},{"name":"Eggelston, Marion","location":"53 E","category":null},{"name":"Eggering, Lisa","location":"19 WC","category":null},{"name":"Eichen, Maximilian","location":"38 WC","category":null},{"name":"Einhorn, Otto","location":"57 E","category":null},{"name":"Eiper, Stefan","location":"55 E","category":null},{"name":"Eirstedt, Greta","location":"29 S","category":null},{"name":"Eiselman, Isabel","location":"16 S","category":null},{"name":"Eisenberg, Jonah","location":"60 S","category":null},{"name":"Eldred, Louise","location":"92 EC","category":null},{"name":"Eldredge, Nancy","location":"12 E","category":null},{"name":"Elephant and Castle Theatre","location":"13 SE","category":null},{"name":"Elephant’s Nest Pub","location":"25 S","category":"Public Houses"},{"name":"Elerick, Quincy","location":"14 S","category":null},{"name":"Elfman, Ingrid","location":"97 EC","category":null},{"name":"Elgin, Sir Giles","location":"66 SW","category":null},{"name":"Eliot, Sir Edward","location":"100 SW","category":null},{"name":"Elizondo, Alberto","location":"36 S","category":null},{"name":"Elkind, Guy","location":"39 WC","category":null},{"name":"Elliot & Fry","location":"30 SW","category":null},{"name":"Elliot, Jonathan","location":"63 NW","category":null},{"name":"Ellis, Henry","location":"30 EC","category":null},{"name":"Ellison & Hargrave","location":"63 WC","category":null},{"name":"Ellsworth & Brach","location":"7 S","category":null},{"name":"Elmsley, George","location":"87 EC","category":null},{"name":"Elmwood, Glenda","location":"27 SW","category":null},{"name":"Elston, Howard","location":"21 E","category":null},{"name":"Emard, Cornelia","location":"56 SW","category":null},{"name":"Embry, Cynthia","location":"2 WC","category":null},{"name":"Emerson & Roth","location":"96 WC","category":null},{"name":"Emmits, Hugh","location":"50 SE","category":null},{"name":"Emmons, Jerome","location":"61 E","category":null},{"name":"Endicott, Sir Walter","location":"2 NW","category":null},{"name":"Endzweig, Gerd","location":"79 E","category":null},{"name":"Engelhard, Janet","location":"11 WC","category":null},{"name":"Engels, Jewell","location":"47 EC","category":null},{"name":"Engels, Wallace","location":"50 SE","category":null},{"name":"Englehart, Vivian","location":"70 SW","category":null},{"name":"Enloe, Gordon","location":"66 EC","category":null},{"name":"Enokido, Hiroyuki","location":"3 EC","category":null},{"name":"Enos, Percy","location":"65 NW","category":null},{"name":"Enright, Marlowe","location":"7 WC","category":null},{"name":"Enright, Sylvia","location":"51 SE","category":null},{"name":"Enriquez, Jose","location":"86 WC","category":null},{"name":"Eppler, Claus","location":"51 E","category":null},{"name":"Epps Cocoa","location":"76 NW","category":"Cocoa Manufacturers"},{"name":"Epsoms, Rory","location":"3 NW","category":"Solicitors"},{"name":"Epstein, Aaron","location":"52 S","category":null},{"name":"Epstein, Jacob","location":"18 SE","category":null},{"name":"Erez, Benny","location":"16 WC","category":null},{"name":"Erfan, Bahram","location":"67 EC","category":null},{"name":"Ergas, Katharine","location":"4 E","category":null},{"name":"Erickson, Marc","location":"66 NW","category":null},{"name":"Erlandsson, Erica","location":"28 WC","category":null},{"name":"Erlanger, Theodore","location":"86 EC","category":null},{"name":"Erskam, Bruce","location":"1 WC","category":null},{"name":"Erskine, Ralph","location":"24 S","category":null},{"name":"Ervin, Tuttey","location":"44 E","category":null},{"name":"Escobedo, Juan","location":"30 SE","category":null},{"name":"Escobedo, Marco","location":"17 SE","category":null},{"name":"Esher, Levi","location":"29 EC","category":null},{"name":"Eshleman, Jotham","location":"17 S","category":null},{"name":"Eskridge, Marcellus","location":"12 S","category":null},{"name":"Essaff, Grace","location":"67 NW","category":null},{"name":"Essex, Allen","location":"2 SW","category":null},{"name":"Essex, Michael","location":"19 SW","category":null},{"name":"Eubanks, Annette","location":"52 SE","category":null},{"name":"Euing, Randolph","location":"29 WC","category":null},{"name":"Eustace, Montgomery","location":"39 NW","category":null},{"name":"Euston Station","location":"52 WC","category":"Stations"},{"name":"Euston, Lord","location":"56 NW","category":null},{"name":"Evening News Standard","location":"9 NW","category":"Prisons"},{"name":"Evenson & Co Gifts","location":"22 NW","category":null},{"name":"Everley Bros., Ltd","location":"96 EC","category":null},{"name":"Eversole, Dean","location":"50 S","category":null},{"name":"Evitts, Allie","location":"83 SE","category":null},{"name":"Ewart, Alan","location":"23 E","category":null},{"name":"Ezzard, Charles","location":"77 SE","category":null},{"name":"Fabbrini, Iacopo","location":"6 EC","category":null},{"name":"Fabergé, Hercule","location":"35 WC","category":null},{"name":"Fabian, Brian","location":"37 WC","category":null},{"name":"Fadeff, Judith","location":"69 EC","category":null},{"name":"Fahey, Kevin","location":"73 SE","category":null},{"name":"Fahey, Paul","location":"54 SE","category":null},{"name":"Fahmi, Akram","location":"37 WC","category":null},{"name":"Fain, Dean","location":"55 SE","category":null},{"name":"Fair, Donald","location":"39 WC","category":null},{"name":"Fairbanks, Sir Nathaniel","location":"27 SW","category":null},{"name":"Fairchild, Patricia","location":"46 SW","category":null},{"name":"Fairhaven, Tilly","location":"2 S","category":null},{"name":"Falco, Antonio","location":"68 EC","category":null},{"name":"Falik, Rudi","location":"11 E","category":null},{"name":"Fallen, Jeanne","location":"44 SW","category":null},{"name":"Falleti, Ignazio","location":"31 E","category":null},{"name":"Fallon, Verner","location":"41 WC","category":null},{"name":"Fallowfield & Hopkins","location":"47 SE","category":null},{"name":"Fan, Chui-Yan","location":"19 SE","category":null},{"name":"Fannel, Derek","location":"84 E","category":null},{"name":"Fanning, Elle","location":"90 NW","category":null},{"name":"Fanta, Grace","location":"47 WC","category":null},{"name":"Fanucci, Angelica","location":"26 S","category":null},{"name":"Farabee, Michael","location":"60 S","category":null},{"name":"Farber, Jeffery","location":"50 EC","category":null},{"name":"Fargo, Ellen","location":"64 E","category":null},{"name":"Farley, Florence","location":"39 WC","category":null},{"name":"Farley, Harold","location":"39 WC","category":null},{"name":"Farley, Laura","location":"50 WC","category":null},{"name":"Farmer & Rogers","location":"90 NW","category":"Department Stores"},{"name":"Farmer, Edward","location":"33 WC","category":null},{"name":"Farmer, Reginald","location":"42 WC","category":null},{"name":"Farquhar, Morley","location":"46 WC","category":null},{"name":"Farringdon, Wallace","location":"33 S","category":null},{"name":"Farringdon, Ward","location":"100 SW","category":null},{"name":"Farrow, Randall","location":"63 E","category":null},{"name":"Farwell, Anne","location":"55 WC","category":null},{"name":"Fassett, Maurice","location":"8 E","category":null},{"name":"Faux, Geraldine","location":"38 WC","category":null},{"name":"Favale, Roberta","location":"25 E","category":null},{"name":"Faversham, F.V.","location":"23 NW","category":null},{"name":"Fawcett, Valerie","location":"27 S","category":null},{"name":"Featherstone, Banks","location":"24 SW","category":null},{"name":"Fedorkin, Nicholas","location":"58 SE","category":null},{"name":"Fehr, Juergen","location":"46 S","category":null},{"name":"Feigenbaum, Roger","location":"51 S","category":null},{"name":"Fein, Sean","location":"61 SE","category":null},{"name":"Feinberg, James","location":"78 E","category":null},{"name":"Feiner, Elliot","location":"29 E","category":null},{"name":"Feingold, Ephraim","location":"30 S","category":null},{"name":"Feld, Lawrence","location":"53 WC","category":null},{"name":"Felder, Ltd","location":"40 WC","category":null},{"name":"Feldmann, Joachim","location":"53 S","category":null},{"name":"Felker, Harry","location":"32 E","category":null},{"name":"Felker, Zack","location":"58 S","category":null},{"name":"Fell, Dr Gideon","location":"55 WC","category":"Doctors"},{"name":"Fendel, James","location":"74 SE","category":null},{"name":"Fenix, Montgomery","location":"85 WC","category":null},{"name":"Fenlon, Stanley","location":"70 EC","category":null},{"name":"Fenner, Sadie","location":"1 E","category":null},{"name":"Fenwick, Louise","location":"9 NW","category":null},{"name":"Fenwick, Merrill","location":"9 NW","category":null},{"name":"Ferdun, Stevie","location":"41 E","category":null},{"name":"Fergus & Co","location":"6 E","category":null},{"name":"Ferguson & Muirhead","location":"16 EC","category":"Tea Merchants"},{"name":"Ferguson, Douglas","location":"54 WC","category":null},{"name":"Ferguson, Robert","location":"3 EC","category":null},{"name":"Ferk, Hugh","location":"28 SW","category":null},{"name":"Fernbach, Ellis","location":"48 WC","category":null},{"name":"Ferris, Arthur","location":"56 WC","category":null},{"name":"Fewell, Glenn","location":"71 E","category":null},{"name":"Fickert, Newton","location":"19 SW","category":null},{"name":"Ficklin, Maxine","location":"27 SE","category":null},{"name":"Fiddyment, Clive","location":"85 E","category":null},{"name":"Field, Christopher","location":"57 WC","category":null},{"name":"Field, Edna","location":"100 SW","category":null},{"name":"Field, Roland","location":"89 WC","category":null},{"name":"Fillmore, Theobald","location":"87 WC","category":null},{"name":"Finck, Graham","location":"58 WC","category":null},{"name":"Finley, Ralph","location":"96 WC","category":null},{"name":"Finsterwald Florist","location":"46 WC","category":"Florists"},{"name":"Finwall, Sir Chester","location":"30 SE","category":null},{"name":"Fisher, Jennifer","location":"1 EC","category":null},{"name":"Fitch, Lord Malcolm","location":"39 SW","category":null},{"name":"Fitzpatrick, Kennedy","location":"20 SE","category":null},{"name":"Flack, Rowena","location":"15 S","category":null},{"name":"Flagg, Theodore","location":"73 E","category":null},{"name":"Flanagan, Kevin","location":"58 S","category":null},{"name":"Fletcher & Stuart","location":"37 S","category":null},{"name":"Flocker, Sid","location":"8 S","category":null},{"name":"Flower and Dean","location":"62 E","category":"Chemists"},{"name":"Fluehr, Gabrielle","location":"72 SW","category":null},{"name":"Fogerty, Josh","location":"28 E","category":null},{"name":"Fogerty, Lauri","location":"51 SW","category":null},{"name":"Fogerty, Sean","location":"94 EC","category":null},{"name":"Fong, Kim Quon","location":"40 SW","category":null},{"name":"Football Association","location":"55 NW","category":"Sport (Association)"},{"name":"Forbes, Michael","location":"22 SE","category":null},{"name":"Foreign Office","location":"92 SW","category":"Government Offices"},{"name":"Forrest, Christine","location":"47 NW","category":null},{"name":"Forster, Marck","location":"52 SW","category":null},{"name":"Forsyth, Patricia","location":"1 WC","category":null},{"name":"Forsyth, Ward","location":"82 EC","category":null},{"name":"Fortner, Micah","location":"83 SE","category":null},{"name":"Foskett & Krug","location":"54 S","category":null},{"name":"Foster & Nielson","location":"77 SW","category":null},{"name":"Foster, Sandra","location":"56 E","category":null},{"name":"Fox, C.W.","location":"38 NW","category":null},{"name":"Foxcroft, Lionel","location":"46 EC","category":null},{"name":"Francis Baird Detective Agency","location":"25 EC","category":"Detective Agencies"},{"name":"Frederick Warne & Co","location":"71 WC","category":null},{"name":"French Embassy","location":"59 SW","category":"Hospitals"},{"name":"Fribourg & Treyer","location":"88 SW","category":"Tobacconists"},{"name":"Friends of Baritsu","location":"83 WC","category":"Sport (Association)"},{"name":"Frikkers, Ernie","location":"44 E","category":null},{"name":"Fry & Sons Cocoa","location":"95 EC","category":"Cocoa Manufacturers"},{"name":"Fry, Elizabeth","location":"100 SW","category":null},{"name":"Fry, Joseph","location":"100 SW","category":null},{"name":"Frying Pan Inn","location":"17 E","category":"Inns"},{"name":"Fussier, Ashley","location":"68 NW","category":null},{"name":"Fussier, Noelle","location":"31 NW","category":null},{"name":"G. Vickers (stationer)","location":"95 WC","category":"Stationers"},{"name":"Gaber, Jeffrey","location":"85 EC","category":null},{"name":"Gabow, Stephen","location":"23 SE","category":null},{"name":"Gabriel, Marie","location":"61 WC","category":null},{"name":"Gage, Ernest","location":"81 WC","category":null},{"name":"Gaillard, Dominic","location":"4 NW","category":null},{"name":"Galen, Clement","location":"71 EC","category":null},{"name":"Gallagher, Michael","location":"84 EC","category":null},{"name":"Gamage’s","location":"61 EC","category":"Department Stores"},{"name":"Gamble, Sandra","location":"8 SE","category":null},{"name":"Gandhour, Faith","location":"19 EC","category":null},{"name":"Gannon, Betty","location":"15 E","category":null},{"name":"Garcia, Leticia","location":"2 SE","category":null},{"name":"Gardner, John","location":"82 E","category":null},{"name":"Garey, Sir Miles","location":"55 SW","category":null},{"name":"Garff, Valentine","location":"2 E","category":null},{"name":"Garlow, Julia","location":"61 E","category":null},{"name":"Garraway Restaurant","location":"85 EC","category":"Restaurants"},{"name":"Garret, Alfie","location":"38 E","category":null},{"name":"Garrideb, Nathan","location":"59 WC","category":null},{"name":"Garrison, Joseph","location":"6 E","category":null},{"name":"Garthwait, Evan","location":"42 E","category":null},{"name":"Gartling’s Art Salon","location":"75 WC","category":"Auction Houses"},{"name":"Gartmore & Pearce","location":"21 EC","category":null},{"name":"Gaskell, Isadora","location":"73 SW","category":null},{"name":"Gass & Co","location":"42 EC","category":null},{"name":"Gassert, Sidney","location":"65 SW","category":null},{"name":"Gates, Delmar","location":"41 SE","category":null},{"name":"Gates, Horatio","location":"11 E","category":null},{"name":"Gas Works","location":"90 E","category":null},{"name":"Geffen, DeWitt","location":"74 SW","category":null},{"name":"Gelder & Co","location":"81 E","category":null},{"name":"Gendell, Thornton","location":"60 WC","category":null},{"name":"Gentry, David","location":"5 NW","category":null},{"name":"George & Vulture Inn","location":"93 WC","category":"Inns"},{"name":"Gerhardt, Otto","location":"7 EC","category":null},{"name":"German Embassy","location":"9 SW","category":"Embassies"},{"name":"Gertbascher, Hans","location":"69 NW","category":null},{"name":"Gervais, Annette","location":"65 WC","category":null},{"name":"Getz, Stanley","location":"22 S","category":null},{"name":"Gharib, Daghy","location":"31 SE","category":null},{"name":"Ghirardi, Lotario","location":"10 S","category":null},{"name":"Giannini, Emilio","location":"8 S","category":null},{"name":"Gibbons, Laurette","location":"42 SE","category":null},{"name":"Gibbons, Andrew","location":"70 NW","category":null},{"name":"Gibbons, John","location":"5 NW","category":null},{"name":"Gibilsco, Dr","location":"46 SE","category":"Doctors"},{"name":"Giblin & Marlowe","location":"39 S","category":null},{"name":"Giddis, Rachel","location":"95 EC","category":null},{"name":"Gifford, Fred","location":"1 S","category":null},{"name":"Gilbert & Field (bookseller)","location":"41 EC","category":"Booksellers"},{"name":"Gilbert, James Williams","location":"100 SW","category":null},{"name":"Gilbert, Russel","location":"68 WC","category":null},{"name":"Gilbord, Irma","location":"48 S","category":null},{"name":"Gilcrest, Kennono","location":"5 E","category":null},{"name":"Giles, Timothy","location":"63 SE","category":null},{"name":"Gilette, William","location":"71 NW","category":null},{"name":"Gillot & Sons","location":"89 EC","category":"Stationers"},{"name":"Gillow, D.","location":"63 SE","category":null},{"name":"Gilmore, Mildred","location":"69 WC","category":null},{"name":"Gilton, Hoover","location":"64 SE","category":null},{"name":"Ginn, Tong Lai","location":"94 WC","category":null},{"name":"Giordano, Guiseppe","location":"23 SE","category":null},{"name":"Giordano, Mario","location":"38 S","category":null},{"name":"Giraud, Roger","location":"4 EC","category":null},{"name":"Girwood & Cole","location":"1 S","category":null},{"name":"Givens, Bernadette","location":"45 S","category":null},{"name":"Glabe, Ned","location":"80 SE","category":null},{"name":"Gladstone, William","location":"43 SE","category":null},{"name":"Glasenapp, Joseph","location":"94 WC","category":null},{"name":"Glassberg, Nehemiah","location":"55 S","category":null},{"name":"Glasspole & Castley","location":"38 S","category":null},{"name":"Gledhill & Co","location":"49 E","category":null},{"name":"Glenwood, Paulette","location":"22 WC","category":null},{"name":"Glickman, Rubin","location":"33 S","category":null},{"name":"Glidewell, Grover","location":"42 S","category":null},{"name":"Globe Restaurant","location":"19 NW","category":"Restaurants"},{"name":"Glover, Bernadette","location":"46 SE","category":null},{"name":"Glover, Maura","location":"18 WC","category":null},{"name":"Godbolt, Taylor","location":"46 EC","category":null},{"name":"Godfrey, Daniel","location":"51 SE","category":null},{"name":"Godfrey, David","location":"73 SW","category":null},{"name":"Goftman, Moses","location":"40 S","category":null},{"name":"Gold, Bar of (pub)","location":"33 SE","category":null},{"name":"Goldberg, Suzanne","location":"72 NW","category":null},{"name":"Goldblatt, Thomas","location":"35 E","category":null},{"name":"Goldfire, George Taubman","location":"82 WC","category":null},{"name":"Goldini’s Restaurant","location":"48 SW","category":"Restaurants"},{"name":"Goldsmith & Olivier","location":"2 S","category":null},{"name":"Goldsmith, A.A.","location":"1 NW","category":"Dentists"},{"name":"Gong, Wai Fong","location":"5 SE","category":null},{"name":"Gooche, Joan","location":"81 SE","category":null},{"name":"Goode, Charles","location":"25 SW","category":null},{"name":"Goode, Emily","location":"25 SW","category":null},{"name":"Goodenough, Garnett","location":"64 E","category":null},{"name":"Goodfellow, Robin","location":"72 EC","category":null},{"name":"Goodwin, Lord Harold","location":"73 NW","category":null},{"name":"Goodyer & Spink","location":"29 NW","category":null},{"name":"Gordon, Clive","location":"83 EC","category":null},{"name":"Gore, Sadie","location":"87 WC","category":null},{"name":"Gorlinski & Sons","location":"64 E","category":null},{"name":"Gormley, Jack","location":"21 E","category":null},{"name":"Gorski, Natasha","location":"48 SW","category":null},{"name":"Goslow, Libby","location":"30 WC","category":null},{"name":"Gosnell, Gilberta","location":"49 S","category":null},{"name":"Gotelli, Sylvanus","location":"54 S","category":null},{"name":"Gott, Lazarus","location":"28 S","category":null},{"name":"Gough, Albert","location":"8 E","category":null},{"name":"Gould & Sons","location":"68 EC","category":"Chemists"},{"name":"Gould & Gould","location":"56 S","category":null},{"name":"Gould, Michael","location":"100 SW","category":null},{"name":"Gould, Sabina","location":"100 SW","category":null},{"name":"Gould, Stanley","location":"100 SW","category":null},{"name":"Gove, P. B.","location":"54 SE","category":null},{"name":"Government Offices","location":"14 SW","category":"Government Offices"},{"name":"Grabowsky, Josef","location":"74 NW","category":null},{"name":"Grady, Charles","location":"4 NW","category":null},{"name":"Grady, Maya","location":"4 NW","category":null},{"name":"Grady, Myra","location":"19 SW","category":null},{"name":"Grady, Teofista","location":"4 NW","category":null},{"name":"Graf, Horst","location":"83 EC","category":null},{"name":"Graff, Gordon","location":"4 E","category":null},{"name":"Graham, Patrick","location":"26 EC","category":null},{"name":"Grand Hotel","location":"22 WC","category":"Hotels"},{"name":"Grant Arms Co","location":"5 EC","category":"Gunsmiths"},{"name":"Grasso, Hope","location":"31 WC","category":null},{"name":"Grattan, Harley","location":"19 EC","category":null},{"name":"Graven, Lily","location":"60 S","category":null},{"name":"Gray, Mercedes","location":"31 S","category":null},{"name":"Gray, Philip","location":"22 EC","category":null},{"name":"Gray’s Inn","location":"10 WC","category":"Inns of the Courts"},{"name":"Grayson’s Nursery","location":"50 EC","category":"Florists"},{"name":"Great Synagogue","location":"21 SW","category":"Synagogues"},{"name":"Green, The Hon. Philip","location":"34 SW","category":null},{"name":"Green Park","location":"97 SW","category":"Parks"},{"name":"Greenwich Park","location":"63 S","category":"Parks"},{"name":"Greenwood, Victor","location":"25 EC","category":null},{"name":"Gregg, Linda","location":"14 E","category":null},{"name":"Gregory & Co","location":"79 NW","category":null},{"name":"Gregory, Inspector","location":"47 WC","category":null},{"name":"Gregson, Tobias","location":"7 NW","category":null},{"name":"Gresham, Isabel","location":"40 EC","category":null},{"name":"Griggs, Jimmy","location":"29 E","category":null},{"name":"Griggs, Phoebe","location":"59 S","category":null},{"name":"Gross & Hankey’s","location":"90 NW","category":"Parks"},{"name":"Grosvenor Hotel","location":"69 SW","category":"Hotels"},{"name":"Grosvenor Mansions","location":"70 SW","category":null},{"name":"Guildhall","location":"24 EC","category":null},{"name":"Guildhall Free Library","location":"39 EC","category":"Pawnbrokers"},{"name":"Guilfoyle, Marshall","location":"26 NW","category":null},{"name":"Guion Steamship Co","location":"53 E","category":"Steamship Companies"},{"name":"Guisti, Antonio","location":"44 S","category":null},{"name":"Gull, Sir William","location":"76 NW","category":null},{"name":"Gunderson, Wilkie","location":"50 WC","category":"Solicitors"},{"name":"Gupp & Scholwalter","location":"77 E","category":null},{"name":"Gupta, Brijen","location":"24 SE","category":null},{"name":"Gurney, Henry","location":"100 SW","category":null},{"name":"Gwire, Linda","location":"96 WC","category":null},{"name":"Gwydyr House","location":"74 SE","category":null},{"name":"H. & S. R. Goods Station","location":"104 E","category":null},{"name":"H. Laurence Opticians","location":"31 NW","category":null},{"name":"H.J. Nicoll & Co","location":"36 WC","category":null},{"name":"Haag, Edward","location":"41 S","category":null},{"name":"Hackel, Maisie","location":"29 E","category":null},{"name":"Hacker, Constance","location":"47 S","category":null},{"name":"Hackney, Graham","location":"73 EC","category":null},{"name":"Haddad, Munir","location":"48 EC","category":null},{"name":"Haddow, Murdock","location":"30 S","category":null},{"name":"Hadfield, Raymond","location":"82 EC","category":null},{"name":"Hagen, Das","location":"20 EC","category":null},{"name":"Hagman, Charles","location":"67 E","category":null},{"name":"Hahn, Russel","location":"68 E","category":null},{"name":"Hale, Ronald","location":"7 E","category":null},{"name":"Haley’s Baths","location":"57 WC","category":"Charities"},{"name":"Hall, Edward","location":"36 EC","category":"Barristers"},{"name":"Hall, Robert","location":"44 SE","category":null},{"name":"Hall, Trevor","location":"75 NW","category":null},{"name":"Halle, Sir Charles","location":"44 SW","category":null},{"name":"Hallgren, May","location":"54 S","category":null},{"name":"Halliday’s Private Hotel","location":"15 SW","category":"Hotels"},{"name":"Hallin, Hardy","location":"22 E","category":null},{"name":"Halliwell, Lester","location":"57 EC","category":null},{"name":"Hallmark, Edward","location":"33 NW","category":null},{"name":"Halsey, Rowena","location":"20 WC","category":null},{"name":"Hamblin, Marge","location":"40 S","category":null},{"name":"Hamburg-Amerika Line","location":"28 E","category":"Steamship Companies"},{"name":"Hamilton, Emma","location":"5 EC","category":null},{"name":"Hamilton, George","location":"5 EC","category":null},{"name":"Hamilton, Sir Robert","location":"49 SE","category":null},{"name":"Hamlets Cemetery","location":"72 E","category":null},{"name":"Hancock, Sir Everard","location":"74 SW","category":null},{"name":"Hancock, Sir William","location":"77 NW","category":null},{"name":"Handel, Griselda","location":"53 S","category":null},{"name":"Handy, Margot","location":"48 WC","category":null},{"name":"Hanford, Radley","location":"48 S","category":null},{"name":"Hanks, Nancy","location":"24 SE","category":null},{"name":"Hanley, A.","location":"21 SW","category":null},{"name":"Hannant, Abigail","location":"20 EC","category":null},{"name":"Hannover House","location":"82 NW","category":null},{"name":"Happ, Johnny","location":"50 E","category":null},{"name":"Harbinger, Randolph","location":"78 SE","category":null},{"name":"Harbuck & Stram","location":"27 S","category":null},{"name":"Harbuck, M.","location":"55 SE","category":null},{"name":"Harcourt, Maurice","location":"52 SE","category":null},{"name":"Hardcase, Seymour","location":"40 EC","category":null},{"name":"Hardesty, Sir Montague","location":"52 SW","category":null},{"name":"Harding Brothers","location":"89 SE","category":null},{"name":"Harding, T.","location":"42 EC","category":null},{"name":"Harding, W.","location":"1 SE","category":null},{"name":"Hardinge, H.C.","location":"12 SW","category":null},{"name":"Hardy, Andy","location":"41 WC","category":null},{"name":"Hardy, Jean","location":"86 E","category":null},{"name":"Hardy, Sir Charles","location":"19 SW","category":null},{"name":"Hardy, Sir John","location":"28 NW","category":null},{"name":"Hargrove, Edward","location":"73 E","category":null},{"name":"Harker, Horace","location":"78 NW","category":null},{"name":"Harlock, McKinley","location":"57 E","category":null},{"name":"Harper, Benjamin","location":"70 E","category":null},{"name":"Harrigan, Dr M.","location":"35 E","category":"Doctors"},{"name":"Harrington House","location":"10 SW","category":null},{"name":"Harrison, Michael","location":"67 SW","category":null},{"name":"Harrod, C.","location":"34 SW","category":null},{"name":"Hartsfield, B.","location":"5 NW","category":null},{"name":"Hastings, Harry","location":"4 S","category":null},{"name":"Hatchard’s (bookseller)","location":"63 NW","category":"Booksellers"},{"name":"Hatherley, Victor","location":"53 NW","category":null},{"name":"Havercamp, Lyman","location":"29 S","category":null},{"name":"Hawkes, Howey","location":"37 S","category":null},{"name":"Hawkins, L.","location":"11 SE","category":null},{"name":"Haxell’s Restaurant","location":"19 NW","category":"Restaurants"},{"name":"Haymarket Theatre","location":"4 SW","category":"Theatres"},{"name":"Hazen, Milly","location":"23 S","category":null},{"name":"Heathcliff, August","location":"53 SW","category":null},{"name":"Heatherington, Peter","location":"90 NW","category":null},{"name":"Helford, Jack","location":"25 S","category":null},{"name":"Helwig, Gertrude","location":"74 EC","category":null},{"name":"Hendry, Terrence","location":"7 SE","category":null},{"name":"Henekey’s Wine Lodge","location":"10 WC","category":"Public Houses"},{"name":"Henessy, Patrick","location":"75 SE","category":null},{"name":"Hengler’s Circus","location":"47 WC","category":null},{"name":"Henriquez, Maribel","location":"10 S","category":null},{"name":"Henry Whitlock Co","location":"61 EC","category":"Stables"},{"name":"Hensley, Quentin","location":"82 SE","category":null},{"name":"Herne & Sons, Ltd","location":"59 E","category":null},{"name":"Hickman, W.","location":"79 NW","category":null},{"name":"Higgins, Henry","location":"34 NW","category":null},{"name":"Hill, Inspector","location":"1 EC","category":null},{"name":"Hill, Thomas","location":"75 E","category":null},{"name":"Hinshaw, T. S.","location":"80 NW","category":null},{"name":"Hitchcock, François","location":"54 WC","category":null},{"name":"Hoare, F.","location":"25 SE","category":null},{"name":"Hoby & Gullick","location":"89 SW","category":"Shoemakers"},{"name":"Hoch’s Pawnbrokers","location":"26 E","category":"Pawnbrokers"},{"name":"Hodgson","location":"32 WC","category":null},{"name":"Hogan, Patrick","location":"77 E","category":null},{"name":"Hogg, Quintin","location":"35 EC","category":null},{"name":"Holbien, Hans","location":"84 SE","category":null},{"name":"Holborn Restaurant","location":"61 EC","category":"Restaurants"},{"name":"Holden Bros","location":"80 NW","category":null},{"name":"Holder & Stevenson Bank","location":"69 EC","category":"Banks"},{"name":"Holder, Alexander","location":"40 SW","category":null},{"name":"Holder, Arthur","location":"1 SW","category":null},{"name":"Holder, Mary","location":"34 NW","category":null},{"name":"Hollis, V.","location":"11 E","category":null},{"name":"Holmes, Mrs Basil","location":"58 SW","category":null},{"name":"Holmes, Mycroft","location":"8 SW","category":null},{"name":"Holmes, Sherlock","location":"42 NW","category":null},{"name":"Holywell, Fran","location":"71 WC","category":null},{"name":"Home Office","location":"93 SW","category":"Government Offices"},{"name":"Hood, Sir Tyrone","location":"94 NW","category":null},{"name":"Hook, Knowles & Co","location":"56 WC","category":null},{"name":"Hope, Jefferson","location":"73 WC","category":null},{"name":"Hope, Lady Hilda","location":"2 EC","category":null},{"name":"Hope, Rt Hon. Trelawney","location":"2 EC","category":null},{"name":"Hopkins, Inspector Stanley","location":"18 SE","category":null},{"name":"Hopwood, Nancy","location":"83 E","category":null},{"name":"Horowitz, Dr J.","location":"9 S","category":"Doctors"},{"name":"Horrel, Jack","location":"78 E","category":null},{"name":"Hosaya, Emiko","location":"82 NW","category":null},{"name":"Hossain, Zahid","location":"72 WC","category":null},{"name":"Hossainkhail, Abdul","location":"67 SW","category":null},{"name":"Hostinsky, Eugene","location":"75 EC","category":null},{"name":"Hotherstone, Fergus","location":"75 SW","category":null},{"name":"Howell & James Ltd","location":"48 SE","category":null},{"name":"Hudson, Martha","location":"20 SE","category":null},{"name":"Hudson, Mrs","location":"42 NW","category":null},{"name":"Hughes, Clarence","location":"85 SE","category":null},{"name":"Hunt, Stephanie","location":"92 NW","category":null},{"name":"Hunter, M. T.","location":"81 EC","category":null},{"name":"Huntington & Forbush","location":"89 SE","category":null},{"name":"Hyde Park","location":"95 NW","category":"Parks"},{"name":"Hynds, Margret","location":"73 E","category":null},{"name":"I.K.A. Society","location":"77 EC","category":null},{"name":"I.W.M.E. Club","location":"114 E","category":"Clubs"},{"name":"Ibbotson, Fred","location":"40 E","category":null},{"name":"Icardi, Angelo","location":"74 E","category":null},{"name":"Iden, Belle","location":"77 E","category":null},{"name":"Idler, Eric","location":"84 NW","category":null},{"name":"Ifft, Eleanor","location":"76 SW","category":null},{"name":"Iger, Osbert","location":"12 S","category":null},{"name":"Illman, Jonas","location":"26 EC","category":null},{"name":"Imhoff, Vasili","location":"74 WC","category":null},{"name":"Immelman & Wing","location":"83 E","category":null},{"name":"Imperial Club","location":"101 EC","category":"Clubs"},{"name":"India Office","location":"94 SW","category":"Government Offices"},{"name":"Indigent Blind Vis. Soc","location":"11 WC","category":"Charities"},{"name":"Ingalls, Donna","location":"12 WC","category":null},{"name":"Ingersoll, Amy","location":"94 NW","category":null},{"name":"Ingram, Judson","location":"76 EC","category":null},{"name":"Ingram, Mary","location":"5 NW","category":null},{"name":"Inner Temple","location":"33 EC","category":null},{"name":"Innes, Deborah","location":"76 E","category":null},{"name":"Inquisition Pub","location":"5 S","category":"Public Houses"},{"name":"Insani, Viola","location":"80 EC","category":null},{"name":"Invalid Ladies Est","location":"92 NW","category":"Charities"},{"name":"Inwald, Franck","location":"33 E","category":null},{"name":"Ireton, David","location":"79 EC","category":null},{"name":"Irish Social Club","location":"8 SE","category":null},{"name":"Iron Dyke Co","location":"73 SE","category":null},{"name":"Irving, Henry","location":"50 WC","category":null},{"name":"Irwin, E.","location":"5 SE","category":null},{"name":"Irwin, Sam","location":"29 S","category":null},{"name":"Isaacs Ltd","location":"85 E","category":null},{"name":"Isaacs, Paul","location":"78 EC","category":null},{"name":"Isak, Bill","location":"81 E","category":null},{"name":"Isenberg & Goldstein","location":"51 E","category":null},{"name":"Isinger, Kenneth","location":"80 E","category":null},{"name":"Ito, Naoko","location":"81 E","category":null},{"name":"Ivanoff, Victor","location":"26 SE","category":null},{"name":"Iverson, Dan","location":"80 E","category":null},{"name":"Ivie, Lewis","location":"78 SW","category":null},{"name":"Ivory, Edward","location":"41 NW","category":null},{"name":"Ivy Plant Pub","location":"76 SW","category":"Public Houses"},{"name":"Ivy, Dana","location":"12 SE","category":null},{"name":"Ivy, Morgan","location":"85 NW","category":null},{"name":"Izard, Lyman","location":"83 SW","category":null},{"name":"Izzo, Alberto","location":"82 E","category":null},{"name":"J. & E. Bumpus (bookseller)","location":"12 NW","category":"Booksellers"},{"name":"J.J. Goldstein & Son","location":"41 E","category":"Chemists"},{"name":"J. Offord Co","location":"82 NW","category":null},{"name":"J. Small & Co","location":"32 SE","category":null},{"name":"J.W. Benson Ltd","location":"17 NW","category":"Jewellers"},{"name":"Jaber, Yolanda","location":"79 SW","category":null},{"name":"Jabez Wilson’s Pawnbrokers","location":"73 EC","category":"Pawnbrokers"},{"name":"Jackson, Dr","location":"64 EC","category":"Doctors"},{"name":"Jackson’s Yard","location":"1 S","category":null},{"name":"Jackson, T. Ebenezer","location":"75 WC","category":null},{"name":"Jackstraw & Co","location":"11 E","category":null},{"name":"Jacobs, Israel","location":"53 EC","category":null},{"name":"Jaeger, Adolph","location":"46 SE","category":null},{"name":"Jaffe, Willard","location":"26 SE","category":null},{"name":"Jagis, Inez","location":"75 E","category":null},{"name":"Jain, Valeria","location":"78 SW","category":null},{"name":"Jakeways, Gail","location":"38 S","category":null},{"name":"Jamaica Winehouse","location":"97 EC","category":"Public Houses"},{"name":"Jamal, Omar","location":"45 SE","category":null},{"name":"Jamieson, Franck","location":"39 EC","category":null},{"name":"Jamieson, Martha","location":"39 EC","category":null},{"name":"Janas, Eva","location":"76 WC","category":null},{"name":"Jann, Edmund","location":"47 E","category":null},{"name":"Japes, Williams","location":"77 EC","category":"Solicitors"},{"name":"Jaquard, Roland","location":"40 NW","category":null},{"name":"Jardine, Matheson & Co","location":"15 EC","category":"Steamship Companies"},{"name":"Jarett, Loren","location":"42 EC","category":null},{"name":"Jarvis, Conrad","location":"54 E","category":null},{"name":"Jarvis, Mary","location":"85 SE","category":null},{"name":"Jasper & Coleman","location":"24 SW","category":null},{"name":"Jastrow, Konstantine","location":"28 NW","category":null},{"name":"Jeffcoat, Zane","location":"77 WC","category":null},{"name":"Jeffrey, Charley","location":"43 E","category":null},{"name":"Jeffries, Anne","location":"77 SW","category":null},{"name":"Jeffs & Harris","location":"24 NW","category":"Furriers"},{"name":"Jenkel, Samson","location":"45 E","category":null},{"name":"Jenkins, Sir Edwin","location":"68 SW","category":null},{"name":"Jenks & Ramsey","location":"46 EC","category":null},{"name":"Jennings, Bryan","location":"8 NW","category":null},{"name":"Jennings, Sadie","location":"33 S","category":null},{"name":"Jensen, Jack","location":"6 SE","category":null},{"name":"Jerome, Jerome K.","location":"7 EC","category":null},{"name":"Jerrold, Robert","location":"31 SE","category":null},{"name":"Jessup, Corinne","location":"4 S","category":null},{"name":"Jesuit Church","location":"69 EC","category":"Churches"},{"name":"Jeter, Craig","location":"76 SE","category":null},{"name":"Jetton, Sandy","location":"23 E","category":null},{"name":"Jewett, Stole & Co","location":"28 S","category":null},{"name":"Jobe, Oward","location":"77 E","category":null},{"name":"John Taylor Chemists","location":"72 NW","category":"Chemists"},{"name":"John Underwood Hatters","location":"91 NW","category":null},{"name":"Johnson, Boswell","location":"94 WC","category":null},{"name":"Johnson, Leland","location":"6 NW","category":null},{"name":"Johnson, Peter","location":"19 SE","category":null},{"name":"Johnson, Shinwell","location":"52 EC","category":null},{"name":"Jones, G. H.","location":"88 WC","category":null},{"name":"Jones, Inspector Athelney","location":"32 SE","category":null},{"name":"Jones, Inspector Peter","location":"3 WC","category":null},{"name":"Jones, Milson","location":"20 EC","category":null},{"name":"Jones, Nathan","location":"55 SE","category":null},{"name":"Jones, Pearl","location":"78 WC","category":null},{"name":"Jordan & Co Ltd","location":"48 S","category":null},{"name":"Jordan, Kent","location":"40 EC","category":null},{"name":"Joslin, Edgar","location":"79 WC","category":null},{"name":"Joyce, Dick","location":"76 E","category":null},{"name":"Judd, N.","location":"24 SW","category":null},{"name":"Judson, Glenn","location":"80 WC","category":null},{"name":"Juergens, Robert","location":"46 NW","category":null},{"name":"Juster, Tilly","location":"80 E","category":null},{"name":"Justi, Malcolm","location":"86 NW","category":null},{"name":"Juvet, Frederick","location":"53 E","category":null},{"name":"Kaatz, Judith","location":"56 S","category":null},{"name":"Kabibble, Ish","location":"59 S","category":null},{"name":"Kackley, Helen","location":"63 E","category":null},{"name":"Kackley, Shuyler","location":"58 EC","category":null},{"name":"Kadden, Frank","location":"14 SE","category":null},{"name":"Kadie, Noreen","location":"23 WC","category":null},{"name":"Kagawa, Suki","location":"28 SW","category":null},{"name":"Kagran, Heinz","location":"75 SE","category":null},{"name":"Kahn, Ludwig","location":"14 S","category":null},{"name":"Kalhorn, Dora","location":"64 E","category":null},{"name":"Kalinovsky, Igor","location":"54 EC","category":null},{"name":"Kallen, Kathleen","location":"6 NW","category":null},{"name":"Kallgren, Dorothy","location":"54 SW","category":null},{"name":"Kalthoff, Eugene","location":"62 E","category":null},{"name":"Kanary, Gilda","location":"35 S","category":null},{"name":"Kane, Charles","location":"32 SE","category":null},{"name":"Kaplan, Ruth","location":"18 E","category":null},{"name":"Kapps, Stuart","location":"60 E","category":null},{"name":"Karanoff, Fedor","location":"80 E","category":null},{"name":"Karns, Louella","location":"96 EC","category":null},{"name":"Karr, Susan","location":"81 WC","category":null},{"name":"Karth, Wilma","location":"81 SW","category":null},{"name":"Kates, Richard","location":"6 EC","category":null},{"name":"Kaufer, Ephraim","location":"87 NW","category":null},{"name":"Kavanaugh, Dennis","location":"55 EC","category":null},{"name":"Kay, Thomas","location":"70 SW","category":null},{"name":"Kaye, Miles","location":"8 SW","category":null},{"name":"Keane, Edmund","location":"82 WC","category":null},{"name":"Kearney, Elizabeth","location":"43 NW","category":null},{"name":"Kearney, Franklin","location":"83 WC","category":null},{"name":"Kearns, Lucian","location":"49 S","category":null},{"name":"Keating, Diana","location":"57 WC","category":null},{"name":"Keating, Olivia","location":"82 SW","category":null},{"name":"Keck, Neville","location":"86 SE","category":null},{"name":"Keckler, Duncan","location":"25 SW","category":null},{"name":"Keefer, Andrew","location":"97 EC","category":null},{"name":"Keeler & Co","location":"43 S","category":null},{"name":"Keen’s Chop House","location":"37 WC","category":"Restaurants"},{"name":"Keenan, Mallory","location":"31 WC","category":null},{"name":"Keene & Ashwell","location":"87 SW","category":"Chemists"},{"name":"Keerins, Timothy","location":"3 S","category":null},{"name":"Kehoe, Walter","location":"18 SE","category":null},{"name":"Keller, Mike","location":"43 S","category":null},{"name":"Kelley, Marion","location":"91 NW","category":null},{"name":"Kellogg, Cynthia","location":"29 EC","category":null},{"name":"Kellogg, John","location":"29 EC","category":null},{"name":"Kelly, John","location":"60 E","category":null},{"name":"Kemp, Wilson","location":"47 SE","category":null},{"name":"Kempfield, Michael","location":"48 EC","category":null},{"name":"Kempner, Rodney","location":"26 S","category":null},{"name":"Kenbarn, Cicely","location":"51 SW","category":null},{"name":"Kendall, Heloise","location":"72 SW","category":null},{"name":"Kennedy, Colin","location":"92 NW","category":null},{"name":"Kent House","location":"7 WC","category":"Chemists"},{"name":"Kentnor, Clarinda","location":"26 EC","category":null},{"name":"Kepner, Oliver","location":"56 EC","category":null},{"name":"Keswick Paper Hangers","location":"80 EC","category":null},{"name":"Keyes, Francis","location":"84 WC","category":null},{"name":"Keystone, Roger","location":"29 NW","category":null},{"name":"Kibber & Klutz","location":"60 E","category":null},{"name":"Kibber, Jane","location":"3 E","category":null},{"name":"Kidd, Fritz","location":"12 E","category":null},{"name":"Kidney, Michael","location":"144 E","category":null},{"name":"Kidwell, Gussie","location":"55 S","category":null},{"name":"Kiernan, Caesar","location":"95 EC","category":null},{"name":"Kiker, Brian","location":"76 E","category":null},{"name":"Kilbourne, Michael","location":"60 EC","category":null},{"name":"Kilduff, Marshall","location":"6 E","category":null},{"name":"Kilgore, Claude","location":"21 SE","category":null},{"name":"Killeen, Dr John","location":"83 E","category":"Doctors"},{"name":"Kimbel, Ned","location":"18 SE","category":null},{"name":"Kincaid, Thomas","location":"10 E","category":null},{"name":"King, Richard","location":"85 WC","category":null},{"name":"King’s College Hospital","location":"71 WC","category":"Hospitals"},{"name":"Kirk, Ralston","location":"20 S","category":null},{"name":"Kirkwood, Burton","location":"57 EC","category":null},{"name":"Kitts, Ann","location":"81 E","category":null},{"name":"Klee & Sons","location":"23 WC","category":null},{"name":"Kleebaueur, Tobias","location":"61 EC","category":null},{"name":"Klein, Isadora","location":"93 NW","category":null},{"name":"Klodd, Sara","location":"77 SE","category":null},{"name":"Knaresborough House","location":"30 SE","category":"Chemists"},{"name":"Knowles, Tyler","location":"2 E","category":null},{"name":"Knox, Jack","location":"49 EC","category":null},{"name":"Kong, Hop Yee","location":"48 SE","category":null},{"name":"Kopec, Amos","location":"15 S","category":null},{"name":"Korbot, Rene","location":"41 EC","category":null},{"name":"Kouloulias, Lavender","location":"41 EC","category":null},{"name":"Kracht, Hensdorf","location":"36 NW","category":null},{"name":"Krantz, Herbert","location":"2 NW","category":"Barristers"},{"name":"Kreider, Karen","location":"28 SW","category":null},{"name":"Krishner, Harry","location":"94 EC","category":null},{"name":"Krug, Jason","location":"85 SE","category":null},{"name":"Kruller, Heinrich","location":"47 WC","category":null},{"name":"Kurpinsky, Dimitri","location":"51 SE","category":null},{"name":"La Beau, Emile","location":"94 NW","category":null},{"name":"La Cour, Claude","location":"4 E","category":null},{"name":"La Rothiere, Louis","location":"63 SW","category":null},{"name":"Lacay, Adrianne","location":"35 E","category":null},{"name":"Lacey, Booth","location":"23 SE","category":null},{"name":"Lacrosse Association","location":"2 NW","category":"Sport (Association)"},{"name":"Ladd, Nathan","location":"58 EC","category":null},{"name":"Ladies Couriers","location":"16 NW","category":"Guides"},{"name":"Ladies’ Own Tea Association","location":"31 NW","category":"Tea Rooms"},{"name":"Lafferty, Edward","location":"100 SW","category":null},{"name":"Lafferty, Howard","location":"87 WC","category":null},{"name":"Lafford, Paul","location":"17 E","category":null},{"name":"Lagdon, Jeremy","location":"27 EC","category":null},{"name":"Lai, Chi Sum","location":"56 SE","category":null},{"name":"Laine, Robert","location":"39 EC","category":null},{"name":"Laist, Guinevere","location":"53 SW","category":null},{"name":"Lal, Rao","location":"22 SE","category":null},{"name":"Lambert’s","location":"88 SW","category":"Parks"},{"name":"Lambeth Police Station","location":"53 SE","category":"Police Stations"},{"name":"Lampell, Peg","location":"41 E","category":null},{"name":"Lancaster, Errol","location":"29 SW","category":null},{"name":"Landau, André","location":"88 WC","category":null},{"name":"Landmark Ltd","location":"67 SE","category":null},{"name":"Landry, Joseph","location":"89 WC","category":null},{"name":"Lane, Richard","location":"8 NW","category":null},{"name":"Langham Hotel","location":"36 NW","category":"Hotels"},{"name":"Langlois, Paul","location":"92 EC","category":null},{"name":"Lanner, Inspector","location":"43 NW","category":null},{"name":"Lanthorn, V.","location":"74 SW","category":null},{"name":"Lappin, Regina","location":"80 SW","category":null},{"name":"Lariman & Sons","location":"44 E","category":null},{"name":"Larkin, Elizabeth","location":"86 WC","category":null},{"name":"Larkin, Hyde","location":"29 NW","category":null},{"name":"Larsen, Karen","location":"89 E","category":null},{"name":"Larsen, Neils","location":"21 SW","category":null},{"name":"Lassus, Roland de","location":"59 EC","category":null},{"name":"Latham, Walter","location":"48 NW","category":null},{"name":"Latimer, Harold","location":"11 WC","category":null},{"name":"Lattimer’s Bootery","location":"77 NW","category":"Shoemakers"},{"name":"Laud, A. B.","location":"30 SW","category":null},{"name":"Lavelle, Laura","location":"24 WC","category":null},{"name":"Law Society Library","location":"78 WC","category":"Pawnbrokers"},{"name":"Lawford, Nathan","location":"82 E","category":null},{"name":"Lawn Tennis Association","location":"74 EC","category":"Sport (Association)"},{"name":"Lawrence, Joseph","location":"62 EC","category":null},{"name":"Lazzari & Sons","location":"42 E","category":null},{"name":"Le Boff, Chretien","location":"96 EC","category":null},{"name":"Leach, Calvin","location":"16 SE","category":null},{"name":"Leadenhall Market","location":"18 EC","category":"Markets"},{"name":"League of Red-Headed Men","location":"44 WC","category":null},{"name":"Leahy, Denis","location":"6 S","category":null},{"name":"Leander, Clinton","location":"83 NW","category":null},{"name":"Leath & Ross","location":"85 SE","category":"Chemists"},{"name":"Lechmere, Charles","location":"1 E","category":null},{"name":"Lee, John","location":"90 WC","category":null},{"name":"Lee, Robert James","location":"53 SW","category":null},{"name":"Leeds, Kevin","location":"56 S","category":null},{"name":"Leeds, Sir Sanford","location":"30 SW","category":null},{"name":"Leedy, Christopher","location":"20 E","category":null},{"name":"Lefcourt, Victor","location":"87 E","category":null},{"name":"Lefevre Printers","location":"3 EC","category":"Printers"},{"name":"Leggins, Virgil","location":"90 EC","category":null},{"name":"Lehrman & Sons","location":"16 S","category":null},{"name":"Leib, Harry","location":"27 S","category":null},{"name":"Leibendorf, Arnold","location":"19 S","category":null},{"name":"Leiberman, Dinah","location":"36 S","category":null},{"name":"Lejonc, Martine","location":"42 E","category":null},{"name":"Lekas, George","location":"86 E","category":null},{"name":"Leland, Wendell","location":"56 SE","category":null},{"name":"Lenhart, Baldwin","location":"13 NW","category":null},{"name":"Lennox, Tod","location":"51 E","category":null},{"name":"Leopold, Hilda","location":"84 WC","category":null},{"name":"Lepage, Beverly","location":"49 SE","category":null},{"name":"Lerner & Lehoe","location":"6 S","category":null},{"name":"Leroy, Melvern","location":"88 E","category":null},{"name":"Lester, Guy","location":"42 SE","category":null},{"name":"Lester, Mercy","location":"39 SW","category":null},{"name":"Lestrade, Inspector","location":"60 EC","category":null},{"name":"Leuker, Mark","location":"89 SE","category":null},{"name":"Levasseur, Lancelot","location":"20 NW","category":null},{"name":"Levin, Saul","location":"6 S","category":null},{"name":"Levine, David","location":"18 S","category":null},{"name":"Levy, Jacob","location":"79 SE","category":null},{"name":"Lewin, Bradford","location":"27 SW","category":null},{"name":"Lewin, Hubert","location":"53 NW","category":null},{"name":"Lewis, Evangeline","location":"94 NW","category":null},{"name":"Lewis, Sir George","location":"63 NW","category":null},{"name":"Lexington, Mrs","location":"36 SE","category":null},{"name":"Liberty & Co","location":"91 NW","category":"Department Stores"},{"name":"Life Saving Society","location":"44 WC","category":"Sport (Association)"},{"name":"Limehouse Docks","location":"96 E","category":"Docks"},{"name":"Limehouse Station","location":"107 E","category":"Stations"},{"name":"Lincoln, Leslie","location":"30 NW","category":null},{"name":"Lincoln’s Inn","location":"13 WC","category":"Inns of the Courts"},{"name":"Lind, Jeffrey","location":"58 SE","category":null},{"name":"Lindsay & Co","location":"17 NW","category":null},{"name":"Lindsay, Kathleen","location":"19 WC","category":null},{"name":"Lindstrom, Brent","location":"31 SW","category":null},{"name":"Linhart, William","location":"61 EC","category":null},{"name":"Lipton, Stovall","location":"63 SE","category":null},{"name":"Litchfield, David","location":"68 SE","category":null},{"name":"Litchfield, Pamela","location":"67 EC","category":null},{"name":"Little Newspaper Shop","location":"93 WC","category":"Tobacconists"},{"name":"Littlejohn, Clare","location":"22 NW","category":null},{"name":"Litton & Truest","location":"29 S","category":null},{"name":"Liverpool Street Station","location":"9 EC","category":"Stations"},{"name":"Liverpool, Dublin & London Steam","location":"55 E","category":"Steamship Companies"},{"name":"Livingston, Cedrick","location":"50 SW","category":null},{"name":"Livingston, E. S.","location":"53 WC","category":null},{"name":"Llewellyn, Dr Ralph","location":"115 E","category":"Doctors"},{"name":"Lloyd’s Shipping Register","location":"17 EC","category":null},{"name":"Locke, Gerald","location":"34 WC","category":null},{"name":"Logan, Marjorie","location":"49 NW","category":null},{"name":"Logan, Winston","location":"92 WC","category":null},{"name":"Lomax","location":"5 SW","category":null},{"name":"London & Globe Insurance","location":"79 SW","category":"Insurance Companies"},{"name":"London Bridge Station","location":"4 SE","category":"Stations"},{"name":"London Docks","location":"94 E","category":"Docks"},{"name":"London Exchange","location":"22 EC","category":null},{"name":"London Homeopathic","location":"9 WC","category":"Charities"},{"name":"London Hospital","location":"92 E","category":"Hospitals"},{"name":"London Public Library","location":"5 SW","category":null},{"name":"London Rowing Club","location":"66 EC","category":"Sport (Association)"},{"name":"London University College","location":"43 WC","category":null},{"name":"Long, James","location":"44 E","category":null},{"name":"Lorenzo, Amelia","location":"26 EC","category":null},{"name":"Loughram & Co","location":"85 EC","category":null},{"name":"Loveless, Clifton","location":"4 NW","category":null},{"name":"Lowery, Mattie","location":"11 EC","category":null},{"name":"Lubov, Gregor","location":"88 E","category":null},{"name":"Lucas, David","location":"93 WC","category":null},{"name":"Lucas, Eduardo","location":"51 EC","category":null},{"name":"Lucca, Emilia","location":"9 WC","category":null},{"name":"Luker, Horace","location":"65 SW","category":null},{"name":"Lunsford, Millie","location":"86 EC","category":null},{"name":"Lusk, George","location":"63 E","category":null},{"name":"Lutz, Reinhart","location":"23 SE","category":null},{"name":"Lyceum Theatre","location":"18 WC","category":"Theatres"},{"name":"Lydell’s Bakery","location":"34 WC","category":null},{"name":"Lynch, Lady Joan","location":"88 EC","category":null},{"name":"Lynch, Sir Charles","location":"100 SW","category":null},{"name":"Lynch, Sir Frawly","location":"88 EC","category":null},{"name":"Lyons, Michele","location":"2 EC","category":null},{"name":"Lytton, B. F.","location":"75 SW","category":null},{"name":"Maas, Peter","location":"62 EC","category":null},{"name":"Mabry, Lincoln","location":"14 SE","category":null},{"name":"MacArthur, Malcolm","location":"69 SE","category":null},{"name":"MacDonald, Inspector","location":"1 NW","category":null},{"name":"MacDowell, Bruce","location":"16 WC","category":null},{"name":"Mackinnon, Inspector","location":"5 EC","category":null},{"name":"Madame Charpentier","location":"59 SE","category":"Chemists"},{"name":"Madame Lesurier","location":"69 NW","category":null},{"name":"Madame Tussaud’s","location":"46 NW","category":null},{"name":"Maddox, Clifton","location":"34 EC","category":null},{"name":"Madison, Calvert","location":"86 NW","category":null},{"name":"Madison, Debra","location":"86 NW","category":null},{"name":"Madkins, Cal","location":"52 E","category":null},{"name":"Magill, Finn","location":"58 E","category":null},{"name":"Magrane, Jan","location":"84 E","category":null},{"name":"Maguire, Molly","location":"43 SE","category":null},{"name":"Mainhart, Richard","location":"51 EC","category":null},{"name":"Mairs, Maureen","location":"67 E","category":null},{"name":"Malik, Otto","location":"87 EC","category":null},{"name":"Malmquist, Sir Adrian","location":"64 SE","category":null},{"name":"Malott, Beatrice","location":"58 SW","category":null},{"name":"Maltby, William","location":"34 WC","category":null},{"name":"Maltzer, Kirsten","location":"78 E","category":null},{"name":"Mancuso, Guilio","location":"44 SE","category":null},{"name":"Mander, Gerry","location":"93 NW","category":null},{"name":"Mann, Chester","location":"24 NW","category":null},{"name":"Manning, Lyman","location":"46 SW","category":null},{"name":"Manton, Emeline","location":"39 EC","category":null},{"name":"Mappin, W.","location":"87 NW","category":null},{"name":"Marbles, Hartley","location":"91 NW","category":null},{"name":"Marchant, Oscar","location":"42 SW","category":null},{"name":"Mariano, Anthony","location":"39 EC","category":null},{"name":"Mariner’s House","location":"41 S","category":"Settlement Houses"},{"name":"Marlett, Steven","location":"86 SE","category":null},{"name":"Marlowe, Phillip","location":"32 NW","category":null},{"name":"Marrioneaux, Ursala","location":"26 NW","category":null},{"name":"Marsh, August","location":"86 NW","category":null},{"name":"Marshall & Snelgrove","location":"33 NW","category":"Department Stores"},{"name":"Marshall, Grenville","location":"39 WC","category":null},{"name":"Marshall, J.","location":"29 WC","category":null},{"name":"Marshall, William","location":"64 E","category":null},{"name":"Martin Hewitt Det. Agency","location":"77 SE","category":"Detective Agencies"},{"name":"Marx, Carl","location":"70 SE","category":null},{"name":"Marx & Co","location":"36 SE","category":null},{"name":"Marylebone Cricket Club","location":"48 NW","category":"Sport (Association)"},{"name":"Marylebone Workhouse","location":"45 NW","category":null},{"name":"Maryward House","location":"22 E","category":"Settlement Houses"},{"name":"Mason, Cecil","location":"50 SW","category":"Barristers"},{"name":"Mason, Dr Jerrold","location":"12 NW","category":"Doctors"},{"name":"Mason, Oswald","location":"42 WC","category":null},{"name":"Maude, Cyril","location":"6 SE","category":null},{"name":"Mayall & Co","location":"9 WC","category":"Florists"},{"name":"McAlister, Ed","location":"72 SE","category":null},{"name":"McCarthy, John","location":"54 E","category":null},{"name":"McNight, Shirley","location":"6 EC","category":null},{"name":"McNulty, William","location":"63 EC","category":null},{"name":"Medical Examiner","location":"38 EC","category":"Coroner’s Office"},{"name":"Meeks, Sir Jasper","location":"38 EC","category":null},{"name":"Melbin, Ruth","location":"59 EC","category":null},{"name":"Melnikoff, Leonid","location":"79 E","category":null},{"name":"Melquist, Chauncey","location":"69 EC","category":null},{"name":"Mendehall, Morris","location":"76 EC","category":null},{"name":"Mendosa, Santos","location":"76 SW","category":null},{"name":"Meneken, Gilbert","location":"70 E","category":null},{"name":"Mercer","location":"38 SE","category":null},{"name":"Meriwale, Inspector","location":"4 E","category":null},{"name":"Meriwether, Talia","location":"55 EC","category":null},{"name":"Merkie, Maybelle","location":"43 S","category":null},{"name":"Merlo, Robert","location":"32 WC","category":null},{"name":"Merrel, Frederick","location":"85 NW","category":null},{"name":"Merriman, John","location":"2 EC","category":null},{"name":"Merriman, Ross","location":"40 WC","category":null},{"name":"Merritt, Michael","location":"84 NW","category":null},{"name":"Merrow, Charles","location":"73 SE","category":null},{"name":"Mescher, Frieda","location":"61 SE","category":null},{"name":"Meshkoff, Alexi","location":"34 SW","category":null},{"name":"Metcalf, Aubrey","location":"44 SW","category":null},{"name":"Metclaff, Abby","location":"88 WC","category":null},{"name":"Metropole Hotel","location":"27 WC","category":"Hotels"},{"name":"Metropolitan Hotel","location":"10 EC","category":"Hotels"},{"name":"Mettier, Yves","location":"8 EC","category":null},{"name":"Mews, Jay","location":"73 SE","category":null},{"name":"Mexborough Private Hotel","location":"76 EC","category":"Hotels"},{"name":"Meyer, Calvin","location":"53 S","category":null},{"name":"Middle Temple","location":"33 EC","category":null},{"name":"Middlesex Hospital","location":"10 NW","category":"Hospitals"},{"name":"Middleton, Dennis","location":"96 WC","category":null},{"name":"Midland Grand Hotel","location":"16 SE","category":"Hotels"},{"name":"Migdale, Bess","location":"18 EC","category":null},{"name":"Milburn, Randolph","location":"50 NW","category":null},{"name":"Milford, Jessica","location":"44 S","category":null},{"name":"Military Prison","location":"9 SE","category":"Prisons"},{"name":"Millbank Prison","location":"23 SW","category":"Prisons"},{"name":"Miller, Blair","location":"32 SE","category":null},{"name":"Miller, Elena","location":"7 EC","category":null},{"name":"Miller, Susan","location":"32 SE","category":null},{"name":"Millotsky, Gregor","location":"49 EC","category":null},{"name":"Mills, D.","location":"40 WC","category":null},{"name":"Mills, Leo","location":"86 SE","category":null},{"name":"Miss L.E. Elwin","location":"31 SE","category":"Guides"},{"name":"Mitchbell, Marcell","location":"27 NW","category":null},{"name":"Mizen, Jonas","location":"126 E","category":null},{"name":"Mobley, Anne","location":"81 NW","category":null},{"name":"Mobley, Denis","location":"81 NW","category":null},{"name":"Mobley, John","location":"56 WC","category":null},{"name":"Mockbee, Cyrus","location":"54 SW","category":null},{"name":"Moffit & Moffit","location":"83 E","category":null},{"name":"Mohler, John","location":"83 E","category":null},{"name":"Molloy, Patrick","location":"1 E","category":null},{"name":"Moncrief, Shelley","location":"11 S","category":null},{"name":"Monfredini, Angelica","location":"46 S","category":null},{"name":"Monks, Goddard","location":"85 E","category":null},{"name":"Monroe, John","location":"43 SW","category":null},{"name":"Monroe, Virginia","location":"43 SW","category":null},{"name":"Monson, Chester","location":"78 E","category":null},{"name":"Montague, Chretien","location":"86 E","category":null},{"name":"Montgomery, Inspector","location":"19 S","category":null},{"name":"Montgomery, Willis","location":"87 E","category":null},{"name":"Moody, Burt","location":"86 E","category":null},{"name":"Moore & Burgess","location":"96 WC","category":null},{"name":"Moorehead, Dory","location":"44 NW","category":null},{"name":"Morford, Antonia","location":"66 E","category":null},{"name":"Morgan & Co","location":"68 NW","category":"Stables"},{"name":"Morgan, Melissa","location":"5 S","category":null},{"name":"Morgue (Old Montague)","location":"24 E","category":null},{"name":"Morningstar, Mary","location":"4 SW","category":null},{"name":"Morris, William","location":"3 EC","category":"Solicitors"},{"name":"Morrissey & Cassidy","location":"44 S","category":null},{"name":"Mortimer Storehouse","location":"95 WC","category":null},{"name":"Mortimer House","location":"54 NW","category":null},{"name":"Mortis, Rigor","location":"4 EC","category":null},{"name":"Mortlock & Sons","location":"86 NW","category":null},{"name":"Moser’s Detective Agency","location":"18 WC","category":"Detective Agencies"},{"name":"Moultre & Sons","location":"86 NW","category":null},{"name":"Mozzetti, Enrico","location":"20 E","category":null},{"name":"Mrs Cory’s","location":"25 SE","category":"Barristers"},{"name":"Mrs Hagwood’s","location":"7 EC","category":"Barristers"},{"name":"Mrs Jetley’s","location":"7 SE","category":"Barristers"},{"name":"Mrs Robertson’s","location":"78 NW","category":"Barristers"},{"name":"Mrs Warren’s","location":"76 WC","category":"Barristers"},{"name":"Mudge, Uriah","location":"59 SW","category":null},{"name":"Mudie’s Select Library","location":"36 WC","category":"Pawnbrokers"},{"name":"Mueller, Johanna","location":"80 NW","category":null},{"name":"Mueller, Otto","location":"80 NW","category":null},{"name":"Muldoon, Katie","location":"9 S","category":null},{"name":"Mulgrave, Matthew","location":"77 EC","category":null},{"name":"Mummer & Baskin","location":"18 E","category":null},{"name":"Munding, Lorinda","location":"65 E","category":null},{"name":"Mundy, Edward","location":"2 S","category":null},{"name":"Murray, H.R.","location":"22 SW","category":null},{"name":"Murray, Mortimer","location":"43 WC","category":null},{"name":"Murthwaite, Leonard","location":"28 SW","category":null},{"name":"Musgrove, Lord Gordon","location":"79 NW","category":null},{"name":"Myster, Hans","location":"87 SE","category":null},{"name":"Nadeau, Pierre","location":"77 SW","category":null},{"name":"Nag’s Head Pub","location":"48 E","category":"Public Houses"},{"name":"Nagy, John","location":"57 WC","category":null},{"name":"Nance, Ezra","location":"82 WC","category":null},{"name":"Nance, George","location":"8 EC","category":null},{"name":"Nance, Yvonne","location":"32 NW","category":null},{"name":"Naris, Moss","location":"36 E","category":null},{"name":"Nash, Eugene","location":"78 NW","category":null},{"name":"Nash, John","location":"38 SE","category":null},{"name":"Nast, Flavius","location":"51 WC","category":"Barristers"},{"name":"National Fur Store","location":"64 WC","category":"Furriers"},{"name":"National Gallery","location":"24 WC","category":null},{"name":"Naughton & Sons","location":"35 S","category":null},{"name":"Nava, Fernando","location":"16 E","category":null},{"name":"Navarro, Hector","location":"77 NW","category":null},{"name":"Naven, Lionel","location":"87 SE","category":null},{"name":"Navsky, Roelof","location":"74 E","category":null},{"name":"Neber, Manfred","location":"75 E","category":null},{"name":"Nedham Ltd","location":"67 E","category":null},{"name":"Needham, Sir Vincent","location":"10 EC","category":null},{"name":"Neff, Francine","location":"17 S","category":null},{"name":"Negley, George","location":"45 SE","category":null},{"name":"Negretty & Zambra","location":"35 SE","category":null},{"name":"Neil, John","location":"123 E","category":null},{"name":"Nelandar & Crass","location":"81 EC","category":null},{"name":"Nelder, Anna","location":"3 EC","category":null},{"name":"Nelken, Sid","location":"53 E","category":null},{"name":"Nelson Tavern","location":"114 E","category":"Inns"},{"name":"Nelson, Lola","location":"31 EC","category":null},{"name":"Nelson, Wayne","location":"24 NW","category":null},{"name":"Nerden, Patricia","location":"10 E","category":null},{"name":"Nervo, Rodrigo","location":"89 E","category":null},{"name":"Nesbitt, Edward","location":"12 SE","category":null},{"name":"Nestor, Clyde M.","location":"11 EC","category":null},{"name":"Nethercott & Stims","location":"76 E","category":null},{"name":"Nettleship Bros","location":"61 SE","category":null},{"name":"Neuberger, Benjamin","location":"22 E","category":null},{"name":"Neudorf, Paul von","location":"78 SW","category":null},{"name":"Nevers, Alfred","location":"62 WC","category":null},{"name":"Nevil, Gwendolyn","location":"51 NW","category":null},{"name":"Nevill’s Turkish Baths","location":"92 WC","category":"Charities"},{"name":"Newberry Ltd","location":"7 E","category":null},{"name":"Newbold, Elliot","location":"62 SE","category":null},{"name":"Newbury, Merlin","location":"26 NW","category":null},{"name":"Newgate Prison","location":"36 EC","category":"Prisons"},{"name":"Newhall, Lionel","location":"89 SW","category":null},{"name":"Newmarch, Edgar","location":"75 NW","category":null},{"name":"Newmarch, Norman","location":"100 SW","category":null},{"name":"Niblick, Stephen","location":"86 EC","category":null},{"name":"Nichols, Evelyn","location":"74 NW","category":null},{"name":"Nielson, Dorre","location":"9 NW","category":null},{"name":"Nigh, Carley","location":"33 E","category":null},{"name":"Nightingale, Ogden","location":"32 NW","category":null},{"name":"Niland, Eric","location":"35 WC","category":null},{"name":"Niles, Lydia","location":"33 WC","category":null},{"name":"Nims, Bernard","location":"46 SE","category":null},{"name":"Nishimoto, Teruko","location":"24 E","category":null},{"name":"Niven, Amanda","location":"41 WC","category":null},{"name":"Niven, Maurice","location":"41 WC","category":null},{"name":"Nixdorf, Luther","location":"37 E","category":null},{"name":"Noakes, Morton","location":"61 E","category":null},{"name":"Noble, Rudolph","location":"1 NW","category":null},{"name":"Noily, John","location":"65 WC","category":null},{"name":"Nolan, Frances","location":"46 WC","category":null},{"name":"Nolan, Loretta","location":"21 SW","category":null},{"name":"Noonan, Gilbert","location":"73 NW","category":null},{"name":"Norbeck, Waldo","location":"80 E","category":null},{"name":"Norby, Sumps & Co","location":"57 E","category":null},{"name":"Nordstrom, Olaf","location":"8 EC","category":null},{"name":"Norell, Harold","location":"15 EC","category":null},{"name":"Norgate & Co","location":"41 WC","category":null},{"name":"Norman, Sir Clifton","location":"39 SW","category":null},{"name":"Norman-Neruda, Wilma","location":"72 NW","category":null},{"name":"Norris, Brady","location":"20 WC","category":null},{"name":"Norte, Laura","location":"78 EC","category":null},{"name":"North, F.","location":"71 NW","category":null},{"name":"Northrup, Lucille","location":"47 SE","category":null},{"name":"Northrup, Peter","location":"47 SE","category":null},{"name":"Norville, Herbert","location":"38 SW","category":null},{"name":"Norwood, Curt","location":"64 EC","category":null},{"name":"Noulette, Ed","location":"30 E","category":null},{"name":"Novak, Adams & Co","location":"31 SW","category":null},{"name":"Novak, Irving","location":"70 NW","category":null},{"name":"Novosielsky, Michael","location":"76 SW","category":null},{"name":"Noyes, Marion","location":"52 S","category":null},{"name":"Nudelman, Herman","location":"62 SW","category":null},{"name":"Nugent, Phylis","location":"25 SW","category":null},{"name":"Nunes, Kathryn","location":"15 EC","category":null},{"name":"Nunley & Coops","location":"36 S","category":null},{"name":"Nutter, Lavinia","location":"35 NW","category":null},{"name":"Nyden, Lyle","location":"54 S","category":null},{"name":"Nye, Benjamin","location":"56 SE","category":null},{"name":"O.O. Oliver & Co","location":"61 E","category":null},{"name":"Oakford, Simon","location":"69 SE","category":null},{"name":"Oakley, Mable","location":"1 SE","category":null},{"name":"Oakshot, Maggie","location":"17 SE","category":null},{"name":"Oakshott, Dr Leslie","location":"47 NW","category":null},{"name":"Oakwood, Bernice","location":"34 SW","category":null},{"name":"Oates, Polly","location":"82 NW","category":null},{"name":"Oberfelder, Rudolf","location":"55 WC","category":null},{"name":"Oberstein, Hugo","location":"46 WC","category":null},{"name":"Obias, Roy","location":"18 EC","category":null},{"name":"O’Brian, Barry","location":"69 WC","category":null},{"name":"O’Brian, Disraeli","location":"14 WC","category":null},{"name":"Ocklander, Chauncey","location":"81 E","category":null},{"name":"O’Connel, Leander","location":"40 S","category":null},{"name":"O’Connell, Thomas","location":"80 SW","category":null},{"name":"O’Connor, Denny","location":"26 E","category":null},{"name":"O’Dell, Penny","location":"26 E","category":null},{"name":"Oden, Eldorthe","location":"62 E","category":null},{"name":"Odson, Neil","location":"71 WC","category":null},{"name":"Oetzmann & Co","location":"66 EC","category":null},{"name":"Offen, Blanche","location":"58 SE","category":null},{"name":"Office of Records","location":"14 WC","category":"Government Offices"},{"name":"Offner, Milton","location":"20 NW","category":null},{"name":"Ogden, Emmett","location":"83 EC","category":null},{"name":"Ogilvie, Imogene","location":"17 NW","category":null},{"name":"Ogilvie, Sir Lester","location":"50 WC","category":null},{"name":"O’Grady, Gary","location":"82 WC","category":null},{"name":"O’Hara, Jennifer","location":"68 NW","category":null},{"name":"O’Hara, Patrick","location":"93 NW","category":null},{"name":"Ohcon, Audrey","location":"31 EC","category":null},{"name":"Ohlssen, Sigrid","location":"64 NW","category":null},{"name":"Okada, Mark","location":"59 SE","category":null},{"name":"Okerlund, Max","location":"42 EC","category":null},{"name":"O’Laughlin, Michael","location":"66 EC","category":null},{"name":"Old Bailey","location":"36 EC","category":"Police Stations"},{"name":"Old Montague (morgue)","location":"24 E","category":"Hospitals"},{"name":"Oldacre, Jonas","location":"4 EC","category":null},{"name":"Oldwald, Wilson & Co","location":"63 E","category":null},{"name":"Oldwine, Cornelius","location":"48 SW","category":null},{"name":"Olick, Kenward","location":"15 SE","category":null},{"name":"Oliver, Daniel","location":"45 SE","category":null},{"name":"Olivetto & Luciani","location":"52 S","category":null},{"name":"Ollendorf, Franz","location":"7 E","category":null},{"name":"Olmstead, Jennifer","location":"72 EC","category":null},{"name":"Olner, Rutherford","location":"67 NW","category":null},{"name":"Olympia Theatre, The","location":"63 SW","category":null},{"name":"Omar, Kamal","location":"57 SE","category":null},{"name":"Ondes, Dolly","location":"36 E","category":null},{"name":"O’Neill, Carroll","location":"14 NW","category":null},{"name":"O’Neill, Philip","location":"9 WC","category":null},{"name":"Openshaw, Dr Thomas","location":"92 E","category":null},{"name":"Ophel, Shamir","location":"11 E","category":null},{"name":"Oppenheimer, Stuart","location":"76 WC","category":null},{"name":"Opton, George","location":"34 E","category":null},{"name":"Oram, Mary","location":"8 E","category":null},{"name":"Orbin, Garrett","location":"67 SE","category":null},{"name":"Orchid, Leland","location":"27 E","category":null},{"name":"Orcutt, Audrey","location":"25 NW","category":null},{"name":"Ordway, Bertram","location":"66 SE","category":null},{"name":"Oreta, Delores","location":"45 WC","category":null},{"name":"Orey, Burt","location":"24 E","category":null},{"name":"Orff, Rolph","location":"19 E","category":null},{"name":"Orlaff, Nicholas","location":"84 EC","category":null},{"name":"Ormond, Reginald","location":"54 WC","category":"Solicitors"},{"name":"Ormsby, Nick","location":"31 E","category":null},{"name":"Ormsby, Roger","location":"89 E","category":null},{"name":"Orr, James","location":"81 SW","category":null},{"name":"Ortner & Houle","location":"75 WC","category":"Jewellers"},{"name":"Osborn, Wells","location":"33 NW","category":null},{"name":"Ostler, Jack","location":"70 SE","category":null},{"name":"Oswald, Betty","location":"5 EC","category":null},{"name":"Oswald, Warren","location":"67 EC","category":null},{"name":"Otten, Mamie","location":"65 SW","category":null},{"name":"Outer Docks","location":"98 E","category":"Docks"},{"name":"Outwater & Co","location":"9 S","category":null},{"name":"Overholt, Richmond","location":"82 SW","category":null},{"name":"Overstreet, Marmaduke","location":"1 SE","category":null},{"name":"Overton, Cyril","location":"30 SW","category":null},{"name":"Owen, Ned","location":"16 S","category":null},{"name":"Owen, Ralph","location":"84 SW","category":null},{"name":"Owsley, Richard","location":"10 SE","category":null},{"name":"Oxford Music Hall","location":"13 NW","category":"Music Halls"},{"name":"Oxley, Mavis","location":"84 SE","category":null},{"name":"Packer, Franklin","location":"78 WC","category":null},{"name":"Packham, George","location":"65 NW","category":null},{"name":"Paddock, Astrid","location":"12 E","category":null},{"name":"Padgett, Luke","location":"51 WC","category":null},{"name":"Padway, Winston","location":"23 E","category":null},{"name":"Pahl, Dennis","location":"3 E","category":null},{"name":"Paige, Bruce","location":"24 SE","category":null},{"name":"Painter, Charlotte","location":"80 WC","category":null},{"name":"Painter, Claire","location":"82 WC","category":null},{"name":"Pak, Yong Suk","location":"6 E","category":null},{"name":"Pall Mall Gazette","location":"90 SW","category":"Prisons"},{"name":"Pallas, Gary","location":"32 E","category":null},{"name":"Palmer, Chester","location":"33 NW","category":null},{"name":"Pancoast, Kearney","location":"66 E","category":null},{"name":"Pannikkar, K.M.","location":"84 WC","category":null},{"name":"Paquette, René","location":"63 NW","category":null},{"name":"Paradol Chamber","location":"40 WC","category":null},{"name":"Pardee, Hank","location":"27 E","category":null},{"name":"Parker, Howard","location":"68 EC","category":null},{"name":"Parker, Laura","location":"85 WC","category":null},{"name":"Parker, Steven","location":"43 E","category":null},{"name":"Parks, Charles","location":"31 EC","category":null},{"name":"Parliament, Houses of","location":"16 SW","category":"Government Offices"},{"name":"Parr, Grace","location":"25 EC","category":null},{"name":"Parr, Lucy","location":"40 SW","category":null},{"name":"Parr, Ruth","location":"83 SW","category":null},{"name":"Parrish, Ralph","location":"57 SE","category":null},{"name":"Parsell, Vincent","location":"26 E","category":null},{"name":"Parsons & Sons","location":"18 NW","category":null},{"name":"Parsons, Newton","location":"62 NW","category":null},{"name":"Partridge, Nate","location":"3 SE","category":null},{"name":"Partridge, Sir Clayton","location":"60 SW","category":null},{"name":"Paschal: Investigations","location":"78 WC","category":"Detective Agencies"},{"name":"Pasco, Adam","location":"34 E","category":null},{"name":"Paskin, Alistair","location":"3 SW","category":null},{"name":"Pastore, Dante","location":"57 S","category":null},{"name":"Patch, Daniel","location":"67 SE","category":null},{"name":"Patterson, Inspector","location":"50 EC","category":null},{"name":"Patterson, Neil","location":"69 EC","category":null},{"name":"Pattin, Rodney","location":"1 EC","category":null},{"name":"Pattins, Hugh","location":"60 E","category":null},{"name":"Paul, Robert","location":"5 E","category":null},{"name":"Pauley, Newton","location":"13 SE","category":null},{"name":"Pavich, Dimitri","location":"86 WC","category":null},{"name":"Pavilion Music Hall","location":"20 NW","category":"Music Halls"},{"name":"Pavilion Pub","location":"20 NW","category":"Public Houses"},{"name":"Pawson, Etta","location":"30 E","category":null},{"name":"Paxton, May","location":"37 E","category":null},{"name":"Payne, Everett","location":"88 WC","category":null},{"name":"Peabody, Flavia","location":"26 WC","category":null},{"name":"Peacock, Donna","location":"61 NW","category":null},{"name":"Peacock, Harvey","location":"33 SE","category":null},{"name":"Peake, Minerva","location":"49 SW","category":null},{"name":"Pearl Assurance Co","location":"86 EC","category":"Insurance Companies"},{"name":"Pearlman, Elisha","location":"19 E","category":null},{"name":"Peckham, Lord Bosworth","location":"84 SW","category":null},{"name":"Peddle, Grace","location":"11 E","category":null},{"name":"Peeples, W.","location":"60 NW","category":null},{"name":"Pelletier, Philippe","location":"89 WC","category":null},{"name":"Pemberton, Marvin","location":"73 EC","category":null},{"name":"Pembroke Mission","location":"63 SE","category":"Settlement Houses"},{"name":"Pendergast, Hodge","location":"25 EC","category":null},{"name":"Pennel, Lewis","location":"92 WC","category":null},{"name":"Pennington, Frank","location":"59 NW","category":null},{"name":"Pennock, Nona","location":"70 EC","category":null},{"name":"Pennypacker, Rollo","location":"34 SE","category":null},{"name":"People’s Palace","location":"46 E","category":null},{"name":"Pepin, R.","location":"72 SE","category":null},{"name":"Pepper, Aldo","location":"10 SE","category":null},{"name":"Perkins, Lloyd","location":"47 EC","category":null},{"name":"Perkins, Oliver","location":"68 SE","category":null},{"name":"Perkovich, Solomon","location":"16 SE","category":null},{"name":"Perrin, Linus","location":"21 S","category":null},{"name":"Persanon, Isadora","location":"42 EC","category":null},{"name":"Peter Robinson’s","location":"71 NW","category":"Department Stores"},{"name":"Peterson","location":"41 NW","category":null},{"name":"Petroff, Anatole","location":"22 SE","category":null},{"name":"Pettit, Caufield","location":"32 EC","category":null},{"name":"Petty, C.","location":"24 SW","category":null},{"name":"Petwick, G.","location":"72 EC","category":null},{"name":"Phalen, Gamaliel","location":"20 S","category":null},{"name":"Pharmaceutical Society","location":"39 WC","category":null},{"name":"Phelps, John","location":"58 NW","category":null},{"name":"Phelps, Percy","location":"2 WC","category":null},{"name":"Philimore, James","location":"45 WC","category":null},{"name":"Philipe, James","location":"45 WC","category":null},{"name":"Philipi & Crawford","location":"9 SW","category":null},{"name":"Phillips, Dr George","location":"2 EC","category":"Doctors"},{"name":"Philpot, Judith","location":"44 SE","category":null},{"name":"Piccadilly Hotel","location":"26 NW","category":"Hotels"},{"name":"Pickens, C.","location":"23 SE","category":null},{"name":"Pickering & Chatto","location":"86 SW","category":"Booksellers (used & rare)"},{"name":"Pickering, Morgan","location":"34 SW","category":null},{"name":"Pickett, Lucy","location":"37 NW","category":null},{"name":"Pickfords","location":"98 EC","category":null},{"name":"Pickwick, Sir Colin","location":"58 SW","category":null},{"name":"Piggot, S.","location":"87 WC","category":null},{"name":"Pike, Langdale","location":"2 SW","category":null},{"name":"Pike, Stinson","location":"55 E","category":null},{"name":"Pilsbury, Nicholas","location":"55 S","category":null},{"name":"Pinckney, Simon","location":"70 EC","category":null},{"name":"Pinkerton International","location":"24 NW","category":"Detective Agencies"},{"name":"Pinkerton, Bruce","location":"57 NW","category":null},{"name":"Piper, James","location":"11 EC","category":null},{"name":"Pirlot House","location":"23 S","category":"Barristers"},{"name":"Pitman, Harris","location":"73 SE","category":null},{"name":"Pitman, Sanford","location":"93 WC","category":null},{"name":"Pizer, Robert","location":"91 E","category":null},{"name":"Pokrovsky, Nikolai","location":"4 EC","category":null},{"name":"Pokrovsky, Alexandra","location":"4 EC","category":null},{"name":"Police Gazette","location":"35 EC","category":"Prisons"},{"name":"Polk, Chester","location":"95 WC","category":null},{"name":"Pollack, Constable","location":"61 E","category":null},{"name":"Pollard, Christopher","location":"54 SE","category":null},{"name":"Pollard, Enid","location":"54 SE","category":null},{"name":"Pons, Solar","location":"56 NW","category":null},{"name":"Ponsford, Maxwell","location":"26 SW","category":null},{"name":"Poole & Co","location":"10 EC","category":"Tailors"},{"name":"Poole, Richard","location":"56 WC","category":null},{"name":"Porlock, Fred","location":"18 NW","category":null},{"name":"Porter, Margaret","location":"8 NW","category":null},{"name":"Post, Janice","location":"36 NW","category":null},{"name":"Post, Malcolm","location":"66 SE","category":null},{"name":"Postern & Sons","location":"78 E","category":null},{"name":"Potter, Joe","location":"11 S","category":null},{"name":"Potter, Norman","location":"79 WC","category":null},{"name":"Pound & Co","location":"66 SW","category":null},{"name":"Powell, Ralph","location":"74 SE","category":null},{"name":"Pratt, Grace","location":"64 SE","category":null},{"name":"Pratt, Martha","location":"64 SE","category":null},{"name":"Preedy & Bennett","location":"68 SW","category":null},{"name":"Prendergast, Major","location":"28 NW","category":null},{"name":"Prescott, H.","location":"89 SW","category":null},{"name":"Prescott, Rodger","location":"27 SE","category":null},{"name":"Presmon & Black","location":"24 E","category":null},{"name":"Preston, Norwood","location":"7 WC","category":null},{"name":"Price, Emett","location":"85 EC","category":null},{"name":"Price, Hazel","location":"65 SE","category":null},{"name":"Prichard, Giles","location":"15 EC","category":null},{"name":"Prim, L.","location":"7 EC","category":null},{"name":"Prince’s Skating Club","location":"98 SW","category":"Sport (Association)"},{"name":"Princess Alice Inn","location":"42 E","category":"Inns"},{"name":"Princess Louise Pub","location":"90 EC","category":"Public Houses"},{"name":"Princess Theatre","location":"11 NW","category":"Theatres"},{"name":"Pringle, Mrs","location":"51 EC","category":null},{"name":"Printing Office","location":"95 SW","category":"Government Offices"},{"name":"Provident Insurance","location":"68 EC","category":"Insurance Companies"},{"name":"Pruitt & Ratcliff","location":"46 S","category":null},{"name":"Public Carriage Office","location":"5 WC","category":"Scotland Yard"},{"name":"Pullen, Felix","location":"42 S","category":null},{"name":"Punch & Judy Pub","location":"73 WC","category":"Public Houses"},{"name":"Purcell, Stephen","location":"59 SW","category":null},{"name":"Purdy, Albert","location":"100 SW","category":null},{"name":"Purdy, Daniel","location":"49 SW","category":null},{"name":"Purdy, Joyce","location":"8 S","category":null},{"name":"Purdy, Sally","location":"100 SW","category":null},{"name":"Putner, Beatrice","location":"90 SW","category":null},{"name":"Pyke, Thurston","location":"34 S","category":null},{"name":"Quail, Alvin","location":"48 SE","category":null},{"name":"Quant, Charlotte","location":"7 E","category":null},{"name":"Quare, Tobias","location":"20 EC","category":null},{"name":"Quaritch Books","location":"66 NW","category":"Booksellers (used & rare)"},{"name":"Quatermane, Mathias","location":"49 E","category":null},{"name":"Quattro, Suzanne","location":"16 E","category":null},{"name":"Queen, Anthony","location":"55 NW","category":null},{"name":"Queen’s Head Inn","location":"55 E","category":"Inns"},{"name":"Quering, Clement","location":"62 E","category":null},{"name":"Quesnell, Priscilla","location":"86 EC","category":null},{"name":"Quigley, Martin","location":"60 SE","category":null},{"name":"Quill, Nancy","location":"34 WC","category":null},{"name":"Quillis & Sons","location":"13 E","category":null},{"name":"Quimby, Edward","location":"63 WC","category":null},{"name":"Quinlan, Patricia","location":"44 EC","category":null},{"name":"Quinn, Jane","location":"40 NW","category":null},{"name":"Quint, Ralph","location":"88 SE","category":null},{"name":"Quintana, Emilio","location":"61 WC","category":null},{"name":"Quinton, Griff","location":"37 E","category":null},{"name":"Quirt, Homer","location":"69 SE","category":null},{"name":"Quist Bros","location":"48 NW","category":null},{"name":"Quittel, Sally","location":"88 NW","category":null},{"name":"Quock, George","location":"83 E","category":null},{"name":"R.S. Garrard & Co","location":"44 EC","category":"Jewellers"},{"name":"Rabb, Jonathan","location":"13 E","category":null},{"name":"Race, Minnie","location":"15 SE","category":null},{"name":"Radel, Konrad","location":"56 E","category":null},{"name":"Radford, Jones & Co","location":"11 WC","category":"Tailors"},{"name":"Radovich & Rosen","location":"17 S","category":null},{"name":"Radtke, Gunther","location":"44 EC","category":null},{"name":"Rafael, Gilbert","location":"64 WC","category":null},{"name":"Rafferty, Diana","location":"83 NW","category":null},{"name":"Rafferty, Michael","location":"54 NW","category":null},{"name":"Ragdale, Elbert","location":"56 S","category":null},{"name":"Ragland, Lord Henry","location":"56 SW","category":null},{"name":"Raike, Filbert","location":"34 EC","category":null},{"name":"Railsback, Myles","location":"89 E","category":null},{"name":"Raines, Sarah","location":"61 SW","category":null},{"name":"Raleigh, Dora","location":"22 E","category":null},{"name":"Rambo, Alban","location":"21 SE","category":null},{"name":"Rampton, Steve","location":"23 S","category":null},{"name":"Ramsdell, Thurston","location":"14 E","category":null},{"name":"Ramsey, Herman","location":"32 WC","category":null},{"name":"Rance, Constable John","location":"26 SE","category":null},{"name":"Rand, Glenn","location":"53 NW","category":null},{"name":"Randall, Jane","location":"62 SW","category":null},{"name":"Randell, Martha","location":"38 SE","category":null},{"name":"Randolph, Linda","location":"33 NW","category":null},{"name":"Randolph, Vance","location":"53 EC","category":null},{"name":"Randolph, Vincent","location":"33 NW","category":null},{"name":"Rankin, Abby","location":"39 E","category":null},{"name":"Ransom, Ethel","location":"71 E","category":null},{"name":"Rapoport, Judy","location":"32 E","category":null},{"name":"Rapoport, Stephen","location":"85 E","category":null},{"name":"Ras, Daulat","location":"36 NW","category":null},{"name":"Raskin, Cuthbert","location":"41 E","category":null},{"name":"Ratcliffe, William","location":"52 NW","category":null},{"name":"Rath, Wilber","location":"43 E","category":null},{"name":"Rattley, Mavis","location":"87 E","category":null},{"name":"Raven & Rat Inn","location":"52 EC","category":"Inns"},{"name":"Rawlinson, W.","location":"50 NW","category":null},{"name":"Raymond, Edward","location":"43 E","category":null},{"name":"Reardon, Lorraine","location":"86 NW","category":null},{"name":"Reardon, Osbert","location":"3 EC","category":null},{"name":"Reaston & Co","location":"24 SE","category":null},{"name":"Reaston, John","location":"100 SW","category":null},{"name":"Red Boar Inn","location":"34 SE","category":"Inns"},{"name":"Redburn, Bradley","location":"54 EC","category":null},{"name":"Reece, Calvin","location":"39 SE","category":null},{"name":"Reed, Emerson","location":"16 EC","category":null},{"name":"Reeves & Tucker","location":"38 NW","category":null},{"name":"Regent’s Park","location":"97 NW","category":null},{"name":"Reich, Carson","location":"97 EC","category":null},{"name":"Reid, Megan","location":"57 S","category":null},{"name":"Reilly, Myke","location":"33 SE","category":null},{"name":"Reinhardt, Berger","location":"55 EC","category":null},{"name":"Renfield, Forrest","location":"63 SW","category":null},{"name":"Renshaw, James","location":"62 SE","category":null},{"name":"Retzloff & Lambert","location":"55 S","category":null},{"name":"Reuscher, Griselda","location":"56 EC","category":null},{"name":"Reuters’ Telegraph Agency","location":"87 EC","category":null},{"name":"Revell, Nathan","location":"44 WC","category":null},{"name":"Reynolds, Archibald","location":"34 SE","category":null},{"name":"Rhimer Ltd","location":"27 WC","category":null},{"name":"Rhodes, Janet","location":"85 NW","category":null},{"name":"Rice, Ashley","location":"56 EC","category":null},{"name":"Richards, Dr","location":"83 WC","category":"Doctors"},{"name":"Richards, Lady Hilary","location":"78 NW","category":null},{"name":"Richards, Sir Edmond","location":"78 NW","category":null},{"name":"Richards, Westley","location":"31 NW","category":null},{"name":"Richardson, Laurence","location":"90 SW","category":null},{"name":"Richmond, Otis","location":"39 SW","category":null},{"name":"Ricoletti","location":"27 E","category":null},{"name":"Riddle, Tybalt","location":"74 EC","category":null},{"name":"Rider, Todd","location":"96 EC","category":null},{"name":"Ridgways","location":"24 NW","category":"Tea Merchants"},{"name":"Riding Club","location":"2 NW","category":"Sport (Association)"},{"name":"Rigby & Co","location":"1 SW","category":"Gunsmiths"},{"name":"Rigg, Jozy","location":"34 S","category":null},{"name":"Riley, Jack","location":"65 SE","category":null},{"name":"Rimmel & Sons","location":"26 SW","category":null},{"name":"Ring, The","location":"35 SE","category":null},{"name":"Rittenbaum, Huldah","location":"85 E","category":null},{"name":"Rittenhouse, Joachim","location":"65 WC","category":null},{"name":"Rivinius, Forrest","location":"87 SE","category":null},{"name":"Robarts, Wilfrid","location":"29 NW","category":"Barristers"},{"name":"Robbins, Neal","location":"57 EC","category":null},{"name":"Roberts & Parfitt","location":"88 SE","category":"Tailors"},{"name":"Roberts, Clifford","location":"74 SE","category":null},{"name":"Roberts, Earl","location":"39 SE","category":null},{"name":"Robertson, Sean","location":"15 E","category":null},{"name":"Robinson, Clarence","location":"71 WC","category":null},{"name":"Robles, Thurston","location":"75 SW","category":null},{"name":"Rochefort, Henri","location":"76 NW","category":null},{"name":"Rockett, Stanley","location":"58 EC","category":null},{"name":"Rockwell, Llewellyn","location":"3 SE","category":null},{"name":"Roddy, Iris","location":"27 SW","category":null},{"name":"Rodenburg, Karl","location":"80 EC","category":null},{"name":"Roe, David","location":"95 EC","category":null},{"name":"Rollins, Leslie","location":"76 SW","category":null},{"name":"Romano Restaurant","location":"19 WC","category":"Restaurants"},{"name":"Romero, Giorgio","location":"13 E","category":null},{"name":"Ronder, Eugenia","location":"56 SE","category":null},{"name":"Rooker, Jeanette","location":"46 WC","category":null},{"name":"Rooney, Annie","location":"24 NW","category":null},{"name":"Rosen, Levi","location":"23 E","category":null},{"name":"Ross & Mangles","location":"46 SW","category":null},{"name":"Ross, Sherwood","location":"73 WC","category":null},{"name":"Roster, David","location":"34 WC","category":null},{"name":"Roster, Emily","location":"34 WC","category":null},{"name":"Roster, Maggie","location":"34 WC","category":null},{"name":"Rourke, Mitchell","location":"77 NW","category":null},{"name":"Rowan, Elizabeth","location":"73 EC","category":null},{"name":"Rowe, Betty","location":"46 NW","category":null},{"name":"Rowland, William","location":"36 WC","category":null},{"name":"Rowlands & Frazier","location":"40 NW","category":"Jewellers"},{"name":"Rowlatt, P.","location":"94 EC","category":null},{"name":"Rowney Bros","location":"49 EC","category":null},{"name":"Royal Academy","location":"23 NW","category":null},{"name":"Royal Aquarium","location":"83 SW","category":null},{"name":"Royal Blackheath Golf","location":"61 SW","category":"Sport (Association)"},{"name":"Royal Botanical Gardens","location":"98 NW","category":null},{"name":"Royal Courts of Justice","location":"15 WC","category":null},{"name":"Royal Greenwich Hospital","location":"65 S","category":"Hospitals"},{"name":"Royal Insurance Co","location":"68 NW","category":"Insurance Companies"},{"name":"Royal Italian Circus","location":"35 NW","category":null},{"name":"Royal Mews","location":"36 SW","category":null},{"name":"Royal Military Museum","location":"47 SW","category":null},{"name":"Royal Mint","location":"13 EC","category":null},{"name":"Royal Toxophilite Society","location":"82 NW","category":"Sport (Association)"},{"name":"Royal Victualling Yard","location":"64 S","category":"Markets"},{"name":"Royalty Theatre","location":"15 NW","category":"Theatres"},{"name":"Roycroft, Gifford","location":"25 NW","category":null},{"name":"Rudd, Kirk","location":"76 SE","category":null},{"name":"Rudge & Singer","location":"21 SE","category":"Stables"},{"name":"Rufton, Earl of","location":"53 SW","category":null},{"name":"Rugby Football Union","location":"58 NW","category":null},{"name":"Rule’s Restaurant","location":"19 WC","category":"Restaurants"},{"name":"Rundle & George","location":"68 E","category":null},{"name":"Russel, Matthew","location":"92 EC","category":null},{"name":"Russian Embassy","location":"54 SW","category":"Embassies"},{"name":"Russian Social Club","location":"7 SE","category":null},{"name":"Rutherford, Gladys","location":"75 EC","category":null},{"name":"Rutland, Lord James","location":"64 SW","category":null},{"name":"Rutledge, Sophie","location":"75 NW","category":null},{"name":"Ryan, Timothy","location":"75 SE","category":null},{"name":"Rydell, Mack","location":"87 E","category":null},{"name":"Ryder, James","location":"6 EC","category":null},{"name":"S. Goff Gunsmiths","location":"28 WC","category":"Gunsmiths"},{"name":"Saari, Dr Ilona","location":"3 S","category":"Doctors"},{"name":"Sabatino, Amerigo","location":"21 S","category":null},{"name":"Sabin, Nahum","location":"15 S","category":null},{"name":"Sacha, Bruno","location":"36 SE","category":null},{"name":"Sackett, Jonathan","location":"72 SE","category":null},{"name":"Sackett, Luke","location":"26 E","category":null},{"name":"Saddox & Alquist","location":"49 NW","category":null},{"name":"Sadler, David","location":"10 WC","category":null},{"name":"Saffron Hill House","location":"12 E","category":null},{"name":"Saiferawe, David","location":"4 SW","category":null},{"name":"St Bartholomew’s Hospital","location":"38 EC","category":"Hospitals"},{"name":"St Bride Foundation","location":"63 EC","category":"Printers"},{"name":"St Charles, Dexter","location":"20 SW","category":null},{"name":"St Clair, Neville","location":"32 S","category":null},{"name":"St George’s Baths","location":"28 NW","category":"Charities"},{"name":"St George’s Church","location":"81 NW","category":"Churches"},{"name":"St George’s Hospital","location":"57 SW","category":"Hospitals"},{"name":"St James’s Gazette","location":"89 SW","category":"Prisons"},{"name":"St James’s Hall","location":"22 NW","category":"Printers"},{"name":"St James’s Palace","location":"6 SW","category":null},{"name":"St James’s Park","location":"98 SW","category":"Parks"},{"name":"St Katherine Docks","location":"93 E","category":"Docks"},{"name":"St Katherine’s Steam Wharf","location":"93 E","category":null},{"name":"St Mary Matfelon Church","location":"89 E","category":"Churches"},{"name":"St Mary’s Church","location":"19 EC","category":"Churches"},{"name":"St Pancras Hotel","location":"48 WC","category":"Hotels"},{"name":"St Pancras Station","location":"49 WC","category":"Stations"},{"name":"St Patrick’s Church","location":"57 E","category":"Churches"},{"name":"St Paul’s Cathedral","location":"28 EC","category":"Churches"},{"name":"St Savior’s Church","location":"2 WC","category":null},{"name":"St Simon, Lord Robert","location":"55 SW","category":null},{"name":"St Thomas’ Hospital","location":"29 SE","category":"Hospitals"},{"name":"Salesby, Barry","location":"8 SW","category":null},{"name":"Salisbury, Lord","location":"74 NW","category":null},{"name":"Salkin, Harvey","location":"49 E","category":null},{"name":"Salkind, Bess","location":"14 S","category":null},{"name":"Salop, Jacqueline","location":"53 E","category":null},{"name":"Salsbury, Sabina","location":"3 S","category":null},{"name":"Salter, Duane","location":"9 SW","category":null},{"name":"Saltzman, Murray","location":"40 E","category":null},{"name":"Salvation Army","location":"69 EC","category":"Charities"},{"name":"Salvation Army Hostel","location":"42 SE","category":"Charities"},{"name":"Salvi, Valentine","location":"52 E","category":null},{"name":"Samples, Irving","location":"77 WC","category":null},{"name":"Samples, Maria","location":"35 WC","category":null},{"name":"Samrick, Tod","location":"13 E","category":null},{"name":"Samuels & Braverman","location":"66 E","category":null},{"name":"Samuels, Arthur","location":"56 E","category":null},{"name":"Sanborn Ltd","location":"33 E","category":null},{"name":"Sanders, Karl","location":"73 NW","category":null},{"name":"Sanford, Eudora","location":"44 E","category":null},{"name":"Sanger, John","location":"2 NW","category":null},{"name":"Santiago, Hernando","location":"86 EC","category":null},{"name":"Sarden, Leslie","location":"58 E","category":null},{"name":"Sattui, Victor","location":"72 NW","category":null},{"name":"Saul Leibowitz’s Pawnbrokers","location":"1 E","category":"Pawnbrokers"},{"name":"Saunders, Sedgwick","location":"71 WC","category":null},{"name":"Saunders, Sir James","location":"39 NW","category":null},{"name":"Savage, Keith","location":"77 SE","category":null},{"name":"Savage, Victor","location":"45 WC","category":null},{"name":"Saxe, Osgood","location":"65 SW","category":null},{"name":"Scammon, Stanley","location":"61 E","category":null},{"name":"Schafer, Sandra","location":"61 EC","category":null},{"name":"Schiller, Mark","location":"62 E","category":null},{"name":"Schindler, Reginald","location":"71 NW","category":null},{"name":"Schulenberg, Count von","location":"51 SW","category":null},{"name":"Schwartz, Israel","location":"22 E","category":null},{"name":"Schwerthofer, Maximilian","location":"43 SW","category":null},{"name":"Scopes, Martin","location":"18 S","category":null},{"name":"Scotland Yard","location":"13 SW","category":"Police Stations"},{"name":"Scott, Sir Giles","location":"67 SW","category":null},{"name":"Scottish National Church","location":"51 EC","category":"Churches"},{"name":"Scranton, Micah","location":"65 E","category":null},{"name":"Scully, Swofford & Dugg","location":"21 E","category":null},{"name":"Seagrave, Timothy","location":"72 SW","category":null},{"name":"Seals, Harriet","location":"62 EC","category":null},{"name":"Seamen’s Charity","location":"10 S","category":"Charities"},{"name":"Searle, Trudy","location":"55 E","category":null},{"name":"Seaton, Aggie","location":"40 E","category":null},{"name":"Seaton, Keith","location":"68 E","category":null},{"name":"Sebastian, Richard","location":"8 WC","category":null},{"name":"Sedman, Vera","location":"87 EC","category":null},{"name":"Sedwick, Everett","location":"21 EC","category":null},{"name":"Selby, Lloyd","location":"59 E","category":null},{"name":"Selfridges","location":"74 NW","category":"Department Stores"},{"name":"Selkirk, Alexander","location":"38 SW","category":null},{"name":"Selph, Jasper","location":"40 SW","category":null},{"name":"Sennett, David","location":"27 NW","category":null},{"name":"Serjeant’s Inn","location":"21 NW","category":"Inns"},{"name":"Serlynn, Lois","location":"13 SE","category":null},{"name":"Serovayskaya, Valerya","location":"18 SW","category":null},{"name":"Sewell, Miriam","location":"56 WC","category":null},{"name":"Shackleford, Austin","location":"70 NW","category":null},{"name":"Shackleford, Lydia","location":"70 NW","category":null},{"name":"Shadwell New Basin","location":"95 E","category":"Docks"},{"name":"Shadwell Station","location":"105 E","category":"Stations"},{"name":"Shafton, Milo","location":"57 S","category":null},{"name":"Shallcross, Lucien","location":"7 SW","category":null},{"name":"Shallow & Tinker","location":"15 S","category":null},{"name":"Shane, Alan","location":"48 WC","category":null},{"name":"Shank, Arnold","location":"90 EC","category":null},{"name":"Shank, Martin","location":"71 SE","category":null},{"name":"Shannon, Wilson","location":"66 NW","category":null},{"name":"Shardon, Robert","location":"15 SW","category":null},{"name":"Sharp, Wallace","location":"32 SE","category":null},{"name":"Sharpe, Thomas","location":"57 E","category":null},{"name":"Shaw, Dorothy","location":"69 NW","category":null},{"name":"Shaw, G. B.","location":"79 WC","category":null},{"name":"Shaw, John Bennet","location":"69 NW","category":null},{"name":"Shay, Casey","location":"48 E","category":null},{"name":"Shedd Ltd","location":"33 S","category":null},{"name":"Sheffield, Maynard","location":"29 SW","category":null},{"name":"Shelby, Vincent","location":"67 NW","category":null},{"name":"Shephard, Fay","location":"25 SE","category":null},{"name":"Shephard, Leo","location":"25 SE","category":null},{"name":"Sheriff ’s Wine Lodge","location":"71 EC","category":"Public Houses"},{"name":"Sheringham, Roger","location":"63 SW","category":null},{"name":"Sherman, Elton","location":"6 EC","category":null},{"name":"Sherston, Leigh","location":"90 SW","category":null},{"name":"Sherwood, Florence","location":"22 EC","category":null},{"name":"Shillington, Silvanus","location":"54 SW","category":null},{"name":"Ship & Turtle Restaurant","location":"83 EC","category":"Restaurants"},{"name":"Shiring & Sons","location":"12 S","category":null},{"name":"Shodale, Urban","location":"18 SW","category":null},{"name":"Shoemaker, Lloyd","location":"31 SE","category":null},{"name":"Shoolbred & Co","location":"61 WC","category":"Carpets"},{"name":"Sholto, Bartholomew","location":"51 WC","category":null},{"name":"Sholto, Thaddeus","location":"3 NW","category":null},{"name":"Shooting Society","location":"46 NW","category":"Sport (Association)"},{"name":"Shore, Herbert","location":"50 SW","category":null},{"name":"Shorrock, Annabel","location":"92 WC","category":null},{"name":"Short, Edwin","location":"39 SE","category":null},{"name":"Shortall, Ross","location":"59 SW","category":null},{"name":"Sibley, Christopher","location":"66 SW","category":null},{"name":"Sidley & Sons","location":"32 SE","category":"Carpets"},{"name":"Siebert & Cromwell","location":"26 E","category":null},{"name":"Simkin, Harold","location":"63 NW","category":null},{"name":"Simmerson, Avery","location":"60 E","category":null},{"name":"Simmons, George","location":"20 E","category":null},{"name":"Simmons, Rachel","location":"66 NW","category":null},{"name":"Simmons, Theodore","location":"68 SW","category":null},{"name":"Simpson","location":"49 SE","category":null},{"name":"Simpson’s Cigar Divan","location":"20 WC","category":"Tobacconists"},{"name":"Simpson’s Dining Rooms","location":"20 WC","category":"Restaurants"},{"name":"Simpson, Fitzroy","location":"25 SE","category":null},{"name":"Sinclair, Admiral","location":"52 SW","category":null},{"name":"Sinclair, Archibald","location":"7 WC","category":null},{"name":"Singer, Marylin","location":"54 SE","category":null},{"name":"Sipton Tea Co","location":"39 EC","category":null},{"name":"Sipton, Sir Alfred","location":"100 SW","category":null},{"name":"Sir Galahad’s Pub","location":"27 EC","category":"Public Houses"},{"name":"Skewes, Morley","location":"62 EC","category":null},{"name":"Skinner, Alice","location":"89 EC","category":null},{"name":"Slack, William","location":"40 SE","category":null},{"name":"Sleuth Publications","location":"5 E","category":null},{"name":"Sloan, C.D.","location":"88 WC","category":null},{"name":"Sloane Building","location":"29 WC","category":null},{"name":"Sloane, Sir Sidney","location":"56 SW","category":"Solicitors"},{"name":"Small, Aggie","location":"15 SE","category":null},{"name":"Small, Jonathan","location":"15 SE","category":null},{"name":"Smedley, Dame Agnes","location":"47 NW","category":null},{"name":"Smedley, Lord Winslow","location":"56 SW","category":null},{"name":"Smee, N.S.","location":"81 WC","category":null},{"name":"Smith, Brenda","location":"60 WC","category":null},{"name":"Smith, James","location":"31 NW","category":null},{"name":"Smith Meat Market","location":"44 EC","category":"Markets"},{"name":"Smith, William","location":"45 EC","category":null},{"name":"Smith, Willoughby","location":"3 WC","category":null},{"name":"Smith’s Wharf","location":"21 SE","category":null},{"name":"Smutts, J. A.","location":"40 SE","category":null},{"name":"Snead, Samuel","location":"88 EC","category":null},{"name":"Snelgrove, M.","location":"43 NW","category":null},{"name":"Snell, Albert","location":"43 SE","category":null},{"name":"Soames, Sir Cathcart","location":"84 SW","category":null},{"name":"Somerset House","location":"17 WC","category":null},{"name":"Sommerset & March","location":"33 WC","category":null},{"name":"Sorel, Alexis","location":"70 SW","category":null},{"name":"Sotheby’s","location":"78 NW","category":"Auction Houses"},{"name":"Sotheran & Co (bookseller)","location":"72 WC","category":"Booksellers"},{"name":"South Bromley Station","location":"103 E","category":"Stations"},{"name":"Southwark Park","location":"61 S","category":"Parks"},{"name":"Southwell, Elizabeth","location":"62 NW","category":null},{"name":"Southwick, Collis","location":"32 EC","category":null},{"name":"Spaniard’s Inn","location":"25 SW","category":"Inns"},{"name":"Spanish Embassy","location":"38 SW","category":"Embassies"},{"name":"Spanish Synagogue","location":"19 E","category":"Synagogues"},{"name":"Sparks, Ernest","location":"70 SE","category":null},{"name":"Spaulding, N.","location":"16 WC","category":null},{"name":"Spearpoint, Tim","location":"47 SE","category":null},{"name":"Spectator, The","location":"51 SE","category":"Prisons"},{"name":"Spelvin, Daphne","location":"100 SW","category":null},{"name":"Spelvin, George","location":"72 SW","category":null},{"name":"Spencer, C.","location":"45 SE","category":null},{"name":"Spitalfields Church","location":"55 E","category":"Churches"},{"name":"Spitalfields Market","location":"8 EC","category":"Markets"},{"name":"Spooner, L.","location":"32 EC","category":null},{"name":"Sporting Times","location":"47 EC","category":"Prisons"},{"name":"Sprague, Henrietta","location":"95 WC","category":null},{"name":"Spratling, John","location":"27 EC","category":null},{"name":"Spring, Alice","location":"46 EC","category":null},{"name":"Spurlock, Orlando","location":"88 SW","category":null},{"name":"Squire & Sons","location":"66 WC","category":"Chemists"},{"name":"Sriramulu, Shri","location":"52 SE","category":null},{"name":"Stackhouse, Monroe","location":"13 S","category":null},{"name":"Stackhurst, Harold","location":"40 NW","category":null},{"name":"Stafford, Alden","location":"11 NW","category":null},{"name":"Stahlman, Jason","location":"31 NW","category":null},{"name":"Stamford","location":"12 NW","category":null},{"name":"Stamford’s Geological Est","location":"29 WC","category":"Map Sellers"},{"name":"Stamford, Archie","location":"31 E","category":null},{"name":"Standard, The","location":"40 EC","category":"Prisons"},{"name":"Standish, Milicent","location":"83 WC","category":null},{"name":"Stanton, E.","location":"26 SW","category":null},{"name":"Staple Inn","location":"35 WC","category":"Inns"},{"name":"Star & Plow Inn","location":"73 E","category":"Inns"},{"name":"Star, The","location":"26 NW","category":"Prisons"},{"name":"Stark, Lysander","location":"1 EC","category":null},{"name":"Starling, Hector","location":"23 NW","category":null},{"name":"Staunton, Arthur H.","location":"24 SE","category":null},{"name":"Staunton, Henry","location":"45 E","category":null},{"name":"Stavrosky, Nikolai","location":"95 WC","category":null},{"name":"Steinhauer, Noah","location":"23 S","category":null},{"name":"Stepney Station","location":"106 E","category":"Stations"},{"name":"Sterndale, Leon","location":"51 EC","category":null},{"name":"Sterrit, Henry","location":"10 E","category":null},{"name":"Steven’s Books","location":"63 WC","category":"Booksellers (used & rare)"},{"name":"Stevens, Bert","location":"61 E","category":null},{"name":"Stevenson","location":"9 WC","category":null},{"name":"Stewart, Mrs","location":"38 SE","category":null},{"name":"Stimson & Company","location":"17 SE","category":null},{"name":"Stirge’s Florist","location":"31 SW","category":"Florists"},{"name":"Stock Exchange","location":"22 EC","category":null},{"name":"Stokes, J.","location":"47 SE","category":null},{"name":"Stoops, Gardiner","location":"44 NW","category":null},{"name":"Stoper, Miss","location":"3 NW","category":null},{"name":"Stratford, James","location":"87 EC","category":null},{"name":"Street, G.W.","location":"31 SW","category":null},{"name":"Sukiel, Josephine","location":"66 SE","category":null},{"name":"Sumner Shipping Agent","location":"33 S","category":null},{"name":"Sutherland Plumbing","location":"60 EC","category":null},{"name":"Sutherland, Grant","location":"33 NW","category":null},{"name":"Sutro, Arnold","location":"40 WC","category":"Solicitors"},{"name":"Sutter, Polly","location":"76 SE","category":null},{"name":"Swann, G.","location":"64 EC","category":null},{"name":"Swathmore, Henry","location":"39 NW","category":"Solicitors"},{"name":"Swears & Wells","location":"65 NW","category":null},{"name":"Sweeney, John","location":"67 E","category":null},{"name":"Swift Cycle Co","location":"90 EC","category":"Cycles"},{"name":"Sykes, Demetrius","location":"87 NW","category":null},{"name":"Sylvester Bank","location":"84 EC","category":"Banks"},{"name":"Sylvius, Count Negretto","location":"70 SW","category":null},{"name":"Tackberry, Hannibal","location":"51 S","category":null},{"name":"Tadlock, Phelps & Co","location":"47 S","category":null},{"name":"Taggart, John","location":"73 SW","category":null},{"name":"Talbott, Arthur","location":"67 EC","category":null},{"name":"Talkin, Camilla","location":"89 WC","category":null},{"name":"Talley, Blanche","location":"34 SE","category":null},{"name":"Tangey, Mr","location":"83 WC","category":null},{"name":"Tankerville Club","location":"34 WC","category":"Clubs"},{"name":"Tanner, Elizabeth","location":"62 E","category":null},{"name":"Tapper, Matthias","location":"22 EC","category":null},{"name":"Tarcher, Johann","location":"23 WC","category":null},{"name":"Tarleton, Susan","location":"41 SE","category":null},{"name":"Tarnoff, Ernst","location":"38 E","category":null},{"name":"Tatani, Hiroshi","location":"61 NW","category":null},{"name":"Tate, Lester","location":"69 E","category":null},{"name":"Tattersall, Jillian","location":"70 SE","category":null},{"name":"Tattoo Emporium","location":"24 E","category":null},{"name":"Tatum, Frank","location":"59 SE","category":null},{"name":"Taveres, Eduardo","location":"48 E","category":null},{"name":"Tavernier Modellers","location":"45 SE","category":null},{"name":"Taya, Haruko","location":"82 E","category":null},{"name":"Taylor, Jeremiah","location":"80 SE","category":null},{"name":"Teagarden, Nelson","location":"59 E","category":null},{"name":"Tecott, Enos","location":"17 E","category":null},{"name":"Tedsen, Beata","location":"8 SW","category":null},{"name":"Teest & Schout","location":"32 E","category":null},{"name":"Teevan, Clara","location":"70 E","category":null},{"name":"Teevan, Oscar","location":"16 NW","category":null},{"name":"Telbin, William","location":"59 NW","category":null},{"name":"Telegraph Office","location":"37 EC","category":null},{"name":"Tell, Mary","location":"58 NW","category":null},{"name":"Tell, Robert","location":"12 WC","category":null},{"name":"Temple, The","location":"33 EC","category":"Inns of the Courts"},{"name":"Tendall, Zach","location":"47 E","category":null},{"name":"Tendwell & Krebs","location":"27 EC","category":"Department Stores"},{"name":"Tenney, Luther","location":"11 SE","category":null},{"name":"Tepper, Boyd","location":"35 NW","category":null},{"name":"Tepper, Mack","location":"25 E","category":null},{"name":"Terlau, Ossie","location":"71 E","category":null},{"name":"Tessler, Gideon","location":"63 E","category":null},{"name":"Tetley & Butler","location":"16 NW","category":"Tailors"},{"name":"Thacker, Henry","location":"55 NW","category":null},{"name":"Thames Division","location":"9 E","category":"Scotland Yard"},{"name":"Thames Steamboat Co","location":"40 SE","category":"Steamship Companies"},{"name":"Thayer, Shirley","location":"79 WC","category":null},{"name":"ThickPenny, Mason","location":"79 SE","category":null},{"name":"Thierman, Tad","location":"33 E","category":null},{"name":"Thierry Shoemakers","location":"77 WC","category":"Shoemakers"},{"name":"Thigpen, Tad","location":"19 S","category":null},{"name":"Thomas Wallace & Co","location":"46 EC","category":null},{"name":"Thomas, Anita","location":"4 NW","category":null},{"name":"Thomas, Claire","location":"4 NW","category":null},{"name":"Thomas, George","location":"57 NW","category":null},{"name":"Thornberry, Roger","location":"30 SE","category":null},{"name":"Thorne, Babette","location":"87 E","category":null},{"name":"Thornton, Goody","location":"68 EC","category":null},{"name":"Thrawl Street House","location":"18 E","category":"Barristers"},{"name":"Thrush, Elvira","location":"29 SW","category":null},{"name":"Tibbets, Marlowe","location":"55 WC","category":null},{"name":"Ticknor, Sinclair","location":"47 S","category":null},{"name":"Tidland, Horace","location":"85 EC","category":null},{"name":"Tilden, Charlotte","location":"59 NW","category":null},{"name":"Tilker, Russel","location":"44 SW","category":null},{"name":"Tilton, Matt","location":"36 E","category":null},{"name":"Times, The","location":"30 EC","category":"Prisons"},{"name":"Timms, Peter","location":"7 E","category":null},{"name":"Tinker’s League","location":"65 WC","category":null},{"name":"Tinker, Sir Bennet","location":"42 SE","category":null},{"name":"Tinkham, Stewart","location":"73 SW","category":null},{"name":"Tipple, Coleman","location":"84 E","category":null},{"name":"Tirrel, Kent","location":"21 NW","category":null},{"name":"Titchfield Police Station","location":"89 NW","category":null},{"name":"Tivoli Music Hall","location":"23 WC","category":"Music Halls"},{"name":"Tobias, Marvin","location":"24 WC","category":null},{"name":"Tobin, Edward","location":"81 SE","category":null},{"name":"Toby, Shawn","location":"45 NW","category":null},{"name":"Tod’s Private Enquiries","location":"84 SW","category":"Detective Agencies"},{"name":"Todd, Yolande","location":"4 WC","category":null},{"name":"Tolleson, Derek","location":"63 WC","category":null},{"name":"Tomkins, Joe","location":"28 E","category":null},{"name":"Tomkins, Paul","location":"77 SW","category":null},{"name":"Tonwsell & Kraft","location":"82 EC","category":null},{"name":"Tooker, Nina","location":"22 S","category":null},{"name":"Toomey, John","location":"60 NW","category":null},{"name":"Toost, Doug","location":"73 E","category":null},{"name":"Topham & Marks","location":"24 S","category":null},{"name":"Topper, Dirken","location":"29 NW","category":null},{"name":"Totten, Effie","location":"90 WC","category":null},{"name":"Towle, Glynis","location":"60 SW","category":null},{"name":"Tower of London","location":"14 EC","category":null},{"name":"Townsend, Joseph","location":"74 SW","category":null},{"name":"Toynbee Hall","location":"17 S","category":"Settlement Houses"},{"name":"Traber & Co","location":"50 WC","category":null},{"name":"Tradwell, Bingham","location":"49 SW","category":null},{"name":"Trafton, Paul","location":"50 WC","category":null},{"name":"Trager, Percival","location":"4 E","category":null},{"name":"Train, Kenneth","location":"61 NW","category":null},{"name":"Train, Sally","location":"75 SW","category":null},{"name":"Trajella, Don Luigi","location":"61 SW","category":null},{"name":"Trajella, Dona Caterina","location":"61 SW","category":null},{"name":"Trammel, Wesley","location":"31 S","category":null},{"name":"Tranter’s Temperance Hotel","location":"70 EC","category":"Hotels"},{"name":"Trasher, Lola","location":"51 S","category":null},{"name":"Trask, Squire","location":"25 WC","category":null},{"name":"Travis, Philip","location":"50 EC","category":null},{"name":"Treasury","location":"12 SW","category":null},{"name":"Trelawney Hope, Lady Hilda","location":"2 EC","category":null},{"name":"Trelawney Hope, Sir","location":"2 EC","category":null},{"name":"Trent, Jenny","location":"78 SE","category":null},{"name":"Trevelyan, Dr Percy","location":"4 WC","category":"Doctors"},{"name":"Trevilian, Lord Cyrus","location":"62 NW","category":null},{"name":"Trigg, Milton","location":"84 EC","category":null},{"name":"Troddick, Ginger","location":"93 WC","category":null},{"name":"Trombley, Cecilia","location":"18 E","category":null},{"name":"Trotter, Clarissa","location":"57 SE","category":null},{"name":"Trowbridge, Emery","location":"46 NW","category":null},{"name":"Truax, Robert","location":"39 NW","category":"Barristers"},{"name":"Truesdale, Benedict","location":"26 WC","category":null},{"name":"Tubbs, Egbert","location":"37 NW","category":null},{"name":"Tucker, Jake","location":"82 SE","category":null},{"name":"Tulloch, Howard","location":"31 WC","category":null},{"name":"Tully, John","location":"69 EC","category":null},{"name":"Turnbull, Ebenizer","location":"7 NW","category":null},{"name":"Turnbull, Verna","location":"58 S","category":null},{"name":"Turner, Fred","location":"60 SE","category":null},{"name":"Turner, Mary","location":"60 SE","category":null},{"name":"Turnstall, Constantine","location":"27 WC","category":null},{"name":"Tuson, Sergeant","location":"7 S","category":null},{"name":"Tuttle, Melvin","location":"7 WC","category":"Solicitors"},{"name":"Twas, Geneva","location":"60 NW","category":null},{"name":"Twiggs, Curtis","location":"5 SE","category":null},{"name":"Twining & Co","location":"16 WC","category":"Tea Merchants"},{"name":"Twist, Emily","location":"87 SE","category":null},{"name":"Tyburn Tree","location":"96 NW","category":null},{"name":"Tyler, Steven","location":"62 WC","category":null},{"name":"Tyrrell, Jethro","location":"70 EC","category":null},{"name":"Uber, Alice","location":"71 EC","category":null},{"name":"Udall, Pierce","location":"28 WC","category":null},{"name":"Uhara, Tushina","location":"60 WC","category":null},{"name":"Uhlenbeck, Levi","location":"10 S","category":null},{"name":"Umbel, Bertha","location":"50 E","category":null},{"name":"Underhill, Bilbo","location":"48 SW","category":null},{"name":"Underwood, Arnold","location":"64 NW","category":null},{"name":"Underwood, John","location":"91 NW","category":null},{"name":"Unger, Wayne","location":"12 E","category":null},{"name":"Unity Church","location":"31 E","category":"Churches"},{"name":"Upham, Andrea","location":"15 SW","category":null},{"name":"Upton, Gladys","location":"59 WC","category":null},{"name":"Upton, Gregory","location":"59 WC","category":null},{"name":"Upwood, Colonel","location":"31 NW","category":null},{"name":"Urlich, Roscoe","location":"54 E","category":null},{"name":"Urns, Ashcroft","location":"16 NW","category":null},{"name":"Urquhart, Alonso","location":"31 E","category":null},{"name":"Urrutia, Manuel","location":"58 WC","category":null},{"name":"Uruburu, Anthony","location":"33 NW","category":null},{"name":"Urwitz, Solomon","location":"24 E","category":null},{"name":"Usadell, Lief","location":"15 E","category":null},{"name":"Usher, Anatole","location":"71 EC","category":null},{"name":"Usher, Perry","location":"74 SW","category":null},{"name":"Usher, Phillip","location":"72 EC","category":null},{"name":"Uskert, Bennet","location":"60 S","category":null},{"name":"Utley, Benjamin","location":"67 WC","category":null},{"name":"Uzzel, Nathan","location":"2 E","category":null},{"name":"Vail, Sara","location":"19 E","category":null},{"name":"Valadon & Co","location":"1 SE","category":"Printers"},{"name":"Valdes, General Mario","location":"65 NW","category":null},{"name":"Valentine, Rodney","location":"78 SE","category":null},{"name":"Valier, Dolph","location":"64 E","category":null},{"name":"Valmore, James","location":"68 WC","category":null},{"name":"Valmy, Jack","location":"26 E","category":null},{"name":"Valstad, Kristian","location":"37 E","category":null},{"name":"Van Cleef, Dick","location":"21 E","category":null},{"name":"Van Etten, Theo","location":"26 SW","category":null},{"name":"Van Hoorn, Vincent","location":"54 SE","category":null},{"name":"Van Seddar, Mr","location":"1 EC","category":null},{"name":"Vance, Reynolds","location":"43 SW","category":null},{"name":"Vance, William","location":"42 WC","category":null},{"name":"Vander, Sir Ralph","location":"77 SW","category":null},{"name":"Vanderbrooke, Enoch","location":"88 NW","category":null},{"name":"Vannelli, Enrico","location":"24 E","category":null},{"name":"Varden, Henry","location":"5 E","category":null},{"name":"Varley, Hank","location":"38 E","category":null},{"name":"Varon, Kathy","location":"34 E","category":null},{"name":"Vasey, William","location":"69 WC","category":null},{"name":"Vaughan, Stanley","location":"80 WC","category":null},{"name":"Vegetarian Society","location":"38 E","category":"Charities"},{"name":"Vegetarian Restaurant","location":"74 EC","category":"Restaurants"},{"name":"Venable, Morris","location":"66 NW","category":null},{"name":"Venere, Guilia","location":"66 EC","category":null},{"name":"Venner & Matheson","location":"78 SE","category":null},{"name":"Venters, Evan","location":"88 E","category":null},{"name":"Venucci, Pietro","location":"42 E","category":null},{"name":"Verinder, E.","location":"68 WC","category":null},{"name":"Verinder, Lady Clair","location":"62 SW","category":null},{"name":"Verlaine, Annette","location":"8 WC","category":null},{"name":"Verlaine, Pierre","location":"8 WC","category":null},{"name":"Verner, Christian","location":"81 SW","category":null},{"name":"Verner, Dr","location":"60 SE","category":"Doctors"},{"name":"Vernon, Jack","location":"67 NW","category":null},{"name":"Vest, David","location":"84 SE","category":null},{"name":"Vetter, Stewart","location":"24 E","category":null},{"name":"Vibart, Jules","location":"30 SW","category":null},{"name":"Vickers, Henry","location":"78 SW","category":null},{"name":"Vicknair, Nigel","location":"16 E","category":null},{"name":"Victoria Station","location":"37 SW","category":"Stations"},{"name":"Vidler, David","location":"21 E","category":null},{"name":"Vilmer & Co","location":"31 E","category":null},{"name":"Vincent, Lowell","location":"50 E","category":null},{"name":"Vinson, Barney","location":"29 E","category":null},{"name":"Vittelli, Enrico","location":"34 WC","category":null},{"name":"Vodolagin, Kuzma","location":"89 EC","category":null},{"name":"Vogel, Crumm & Rapp","location":"19 S","category":null},{"name":"Vogler, Hilda","location":"84 NW","category":null},{"name":"Vogler, Klaus","location":"84 NW","category":null},{"name":"Vollweinder, Paulus","location":"79 EC","category":null},{"name":"Volmer & Smerth","location":"36 E","category":null},{"name":"Volsted, Nettie","location":"24 S","category":null},{"name":"Von Bork, Mr","location":"81 WC","category":null},{"name":"Von Herder, Mrs","location":"61 SE","category":null},{"name":"Voorhies, Hans","location":"42 SE","category":null},{"name":"Vorontsev, Baron Peter","location":"39 SW","category":null},{"name":"Vorontsev, Eva","location":"39 SW","category":null},{"name":"Waddington Hall","location":"39 E","category":null},{"name":"Wade, Brent","location":"85 SE","category":null},{"name":"Wadell, Jeremy","location":"79 SW","category":null},{"name":"Wadford, Donald","location":"5 SE","category":null},{"name":"Wagner, George","location":"73 EC","category":null},{"name":"Waite, Mitchell","location":"63 E","category":null},{"name":"Waldenboch Florist","location":"24 NW","category":"Florists"},{"name":"Waldron, Gwen","location":"79 E","category":null},{"name":"Walker, Brenda","location":"30 NW","category":null},{"name":"Wallace, Clint","location":"68 SE","category":null},{"name":"Walraven, Emery","location":"74 E","category":null},{"name":"Walsh, William","location":"70 NW","category":null},{"name":"Walter, Sir James","location":"41 SW","category":null},{"name":"Walter, Valentine","location":"24 SW","category":null},{"name":"Walters, Fred","location":"71 WC","category":null},{"name":"War Office","location":"11 SW","category":"Government Offices"},{"name":"Warburton, Colonel","location":"44 WC","category":null},{"name":"Ward, Julia","location":"22 SW","category":null},{"name":"Warfield, Brian","location":"72 WC","category":null},{"name":"Warner, Richard","location":"74 EC","category":null},{"name":"Warren, Mrs","location":"76 WC","category":null},{"name":"Warrender, Minnie","location":"25 SE","category":null},{"name":"Warwick, Sir Phillip","location":"71 NW","category":null},{"name":"Waterloo Station","location":"37 SE","category":"Stations"},{"name":"Watkins, Edward","location":"98 EC","category":null},{"name":"Watson, Dr John H.","location":"42 NW","category":"Doctors"},{"name":"Watt Street Mission","location":"88 EC","category":"Charities"},{"name":"Watts, Robert","location":"47 WC","category":null},{"name":"Waverly & Broadmore","location":"42 NW","category":null},{"name":"Waygood, Stephen","location":"74 WC","category":null},{"name":"Weatherby, Andrew","location":"8 EC","category":null},{"name":"Weatherwax, Jonathan","location":"56 SE","category":null},{"name":"Weaver, Charles","location":"88 SE","category":null},{"name":"Webb, Rudy","location":"76 WC","category":null},{"name":"Webster, M. B.","location":"80 SW","category":null},{"name":"Weeks, Marsha","location":"75 WC","category":null},{"name":"Weichs, Freiherr","location":"2 EC","category":null},{"name":"Weingarter, Max","location":"60 SE","category":null},{"name":"Weir, Hal","location":"75 EC","category":null},{"name":"Weiss & Sons Cutlery","location":"79 SE","category":null},{"name":"Welch, Gilbert","location":"45 WC","category":null},{"name":"Welker, Gussie","location":"38 E","category":null},{"name":"Weller, Jock","location":"88 SE","category":null},{"name":"Wellesley, A.","location":"57 NW","category":null},{"name":"Wellhouse, Crispin","location":"75 E","category":null},{"name":"Wellington Barracks","location":"33 SW","category":null},{"name":"Welsh Calvinistic Method. Church","location":"11 WC","category":null},{"name":"Wempe, Bessie","location":"86 E","category":null},{"name":"Wempe, Godwin","location":"76 E","category":null},{"name":"Wentworth, Benning","location":"81 SW","category":null},{"name":"Wesley, Harrison","location":"76 EC","category":null},{"name":"Wesleyan College","location":"20 SW","category":null},{"name":"West End Clothiers","location":"16 WC","category":null},{"name":"West End Social Club","location":"12 WC","category":null},{"name":"West India Dock Station","location":"108 E","category":"Stations"},{"name":"West India Docks","location":"97 E","category":"Docks"},{"name":"West Indies Steamship Co","location":"20 EC","category":"Steamship Companies"},{"name":"West, Dyer","location":"77 WC","category":null},{"name":"Westaway’s Governesses","location":"16 NW","category":null},{"name":"Westhouse & Marbank","location":"46 EC","category":"Wine Merchants"},{"name":"Westley, Richards Gunsmiths","location":"31 NW","category":null},{"name":"Westminster Abbey","location":"17 SW","category":"Churches"},{"name":"Westminster Bridge Rd Storehouse","location":"30 SE","category":null},{"name":"Westminster Chapel","location":"88 SW","category":"Churches"},{"name":"Westphail, Honoria","location":"53 EC","category":null},{"name":"Wharton, Jonas","location":"81 WC","category":null},{"name":"Wheelan, Edna","location":"56 NW","category":null},{"name":"Whipple, Flo","location":"68 E","category":null},{"name":"Whitaker’s Almanack","location":"71 EC","category":null},{"name":"White Eagle Pub","location":"50 SE","category":"Public Houses"},{"name":"White Hart Pub","location":"55 SE","category":"Public Houses"},{"name":"White House","location":"60 E","category":"Barristers"},{"name":"White, Drusilla","location":"21 E","category":null},{"name":"Whitechapel Station","location":"102 E","category":"Stations"},{"name":"Whiteley’s","location":"71 EC","category":"Department Stores"},{"name":"Whitney, Elias","location":"51 NW","category":null},{"name":"Whitney, Isa","location":"58 NW","category":null},{"name":"Whitney, Kate","location":"58 NW","category":null},{"name":"Whittaker, Jack","location":"89 SE","category":null},{"name":"Whittier, Malcolm","location":"77 E","category":null},{"name":"Whittington, Lady Alicia","location":"66 SW","category":null},{"name":"Wiggins, Henry","location":"72 NW","category":null},{"name":"Wiggleston, Forney","location":"2 SE","category":null},{"name":"Wilcox, Arnold","location":"83 SW","category":null},{"name":"Williams, Cynthia","location":"76 EC","category":null},{"name":"Wilson, Mrs","location":"1 E","category":null},{"name":"Wimsey, Lord Peter","location":"26 SW","category":null},{"name":"Winchester Arms Co","location":"21 EC","category":"Gunsmiths"},{"name":"Windibank, James","location":"12 NW","category":null},{"name":"Windsor & Newton","location":"32 EC","category":null},{"name":"Wingate, W.","location":"73 NW","category":null},{"name":"Winship, Robertson","location":"59 E","category":null},{"name":"Winslow, Rory","location":"77 EC","category":null},{"name":"Winter, Frances","location":"37 WC","category":null},{"name":"Winter, Kitty","location":"33 E","category":null},{"name":"Wirrick, Marge","location":"88 E","category":null},{"name":"Wishart, Belinda","location":"81 E","category":null},{"name":"Wishmayer, Ezekiel","location":"76 SE","category":null},{"name":"Wisteria Lounge","location":"49 E","category":"Tea Rooms"},{"name":"Witcomb, Sir Simpson","location":"87 SW","category":null},{"name":"Withlock, Herbert","location":"82 SW","category":null},{"name":"Witson & Co","location":"48 E","category":null},{"name":"Wittman, William","location":"74 NW","category":null},{"name":"Wolfe, James","location":"77 NW","category":null},{"name":"Wolff, Philips & Co","location":"44 SE","category":"Tobacconists"},{"name":"Wolmer, Lady Maud","location":"89 SW","category":null},{"name":"Wolmer, Lord Firk","location":"89 SW","category":null},{"name":"Wood, Frederick","location":"82 WC","category":null},{"name":"Wood, Rev. J. G.","location":"75 NW","category":null},{"name":"Woodley, Edith","location":"67 SW","category":null},{"name":"Woodley, Jack","location":"52 SE","category":null},{"name":"Woody, Leo","location":"8 SE","category":null},{"name":"Woolrich, Morton","location":"41 SW","category":null},{"name":"Woolridge, Carrie","location":"84 SW","category":null},{"name":"Woolwich, K.","location":"78 EC","category":null},{"name":"Working Lads’ Institute","location":"10 E","category":"Settlement Houses"},{"name":"Worthingdon Bank","location":"67 NW","category":"Banks"},{"name":"Wyatt, T.","location":"63 SW","category":null},{"name":"Xalis, Wystan","location":"62 E","category":null},{"name":"Xaron, Meg","location":"51 E","category":null},{"name":"Xavier, Clément","location":"79 EC","category":null},{"name":"Xelan, Matt","location":"66 E","category":null},{"name":"Xenos, Zorba","location":"65 SE","category":null},{"name":"Yadlow, Nancy","location":"55 NW","category":null},{"name":"Yale, Laurence","location":"62 SW","category":null},{"name":"Yancy, Roy","location":"40 E","category":null},{"name":"Yapp Shoemakers","location":"83 SE","category":"Shoemakers"},{"name":"Yarbourgh, Virgil","location":"50 S","category":null},{"name":"Yarnell, Willis","location":"88 SE","category":null},{"name":"Ye Old Cheshire Cheese Inn","location":"34 EC","category":"Inns"},{"name":"Yeager, Kevin","location":"8 E","category":null},{"name":"Yelverton, Herbert","location":"76 NW","category":null},{"name":"YMCA","location":"35 NW","category":null},{"name":"York, Basil","location":"48 E","category":null},{"name":"Youghal, I.","location":"21 NW","category":null},{"name":"Young, Courtney","location":"64 SW","category":null},{"name":"Young, William","location":"47 WC","category":null},{"name":"Yule, Spencer","location":"80 EC","category":null},{"name":"Zachariah, George","location":"72 SW","category":null},{"name":"Zack, Aubrey","location":"45 E","category":null},{"name":"Zebediah’s Pawnbrokers","location":"47 E","category":"Pawnbrokers"},{"name":"Zeller, Jarvis","location":"42 E","category":null},{"name":"Ziber, Matilda","location":"82 E","category":null},{"name":"Zobar, Emile","location":"41 WC","category":null},{"name":"Zoological Garden","location":"99 NW","category":null},{"name":"Zubin, Michael","location":"81 EC","category":null},{"name":"Zuker, Kevin","location":"79 NW","category":null},{"name":"Zwiebach, Crumbley","location":"89 SE","category":null}];
let _directoryCats = null;
function DIRECTORY_CATEGORIES() {
  if (!_directoryCats) _directoryCats = [...new Set(LONDON_DIRECTORY.filter(e=>e.category).map(e=>e.category))].sort();
  return _directoryCats;
}

const DIR_CUSTOM_KEY = 'sherlockgm_dir_custom';
const DIR_HIDDEN_KEY = 'sherlockgm_dir_hidden';
let dirCustom = [];
let dirHidden = new Set();
let dirEditingId = null; // id of custom entry currently being edited

function loadDirectoryEdits() {
  try { dirCustom = JSON.parse(store.get(DIR_CUSTOM_KEY) || '[]'); } catch(e) { dirCustom = []; }
  try { dirHidden = new Set(JSON.parse(store.get(DIR_HIDDEN_KEY) || '[]')); } catch(e) { dirHidden = new Set(); }
}

function saveDirectoryEdits() {
  store.set(DIR_CUSTOM_KEY, JSON.stringify(dirCustom));
  store.set(DIR_HIDDEN_KEY, JSON.stringify([...dirHidden]));
}

async function syncDirectoryToServer() {
  if (!currentCaseId) return;
  const payload = JSON.stringify({ custom: dirCustom, hidden: [...dirHidden] });
  const path = `dir-overrides/${currentCaseId}.json`;
  const blob = new Blob([payload], { type: 'application/json' });
  // upsert: upload with overwrite
  const { error } = await sb.storage.from('clues').upload(path, blob, { upsert: true, contentType: 'application/json' });
  if (error) console.warn('dir sync upload error:', error.message);
}

async function loadDirectoryFromServer(caseId) {
  if (!caseId) return;
  try {
    const { data } = sb.storage.from('clues').getPublicUrl(`dir-overrides/${caseId}.json`);
    const res = await fetch(data.publicUrl + '?t=' + Date.now());
    if (!res.ok) return;
    const json = await res.json();
    if (Array.isArray(json.custom)) dirCustom = json.custom;
    if (Array.isArray(json.hidden)) dirHidden = new Set(json.hidden);
    // Also persist locally for offline use
    saveDirectoryEdits();
  } catch(e) { /* no overrides file yet — that's fine */ }
}

function allDirectoryCategories() {
  const custom = dirCustom.map(e=>e.category).filter(Boolean);
  return [...new Set([...DIRECTORY_CATEGORIES(), ...custom])].sort();
}

function buildDirectoryView() {
  const builtIn = LONDON_DIRECTORY.filter(e => !dirHidden.has(e.name));
  const customNames = new Set(dirCustom.map(e=>e.name.toLowerCase()));
  return [
    ...dirCustom,
    ...builtIn.filter(e => !customNames.has(e.name.toLowerCase()))
  ];
}

function populateDirectoryCategoryDropdown() {
  const sel = document.getElementById('directory-category');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>';
  allDirectoryCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    sel.appendChild(opt);
  });
  sel.value = current;

  const dl = document.getElementById('dir-categories-list');
  if (dl) {
    dl.innerHTML = '';
    allDirectoryCategories().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; dl.appendChild(opt);
    });
  }
}

function openDirectory() {
  loadDirectoryEdits();
  populateDirectoryCategoryDropdown();
  document.getElementById('directory-search').value = '';
  document.getElementById('directory-category').value = '';
  document.getElementById('directory-results').innerHTML = '<div class="directory-empty">Enter a name or select a category to search.</div>';
  document.getElementById('directory-results-info').textContent = '';
  const addBtn = document.getElementById('directory-add-btn');
  if (addBtn) addBtn.style.display = isGM ? '' : 'none';
  const addForm = document.getElementById('directory-add-form');
  if (addForm) addForm.style.display = 'none';
  dirEditingId = null;
  openModal('modal-directory');
  setTimeout(() => document.getElementById('directory-search').focus(), 80);
}

function toggleDirectoryAddForm() {
  const form = document.getElementById('directory-add-form');
  if (!form) return;
  const open = form.style.display !== 'none';
  if (open && dirEditingId) {
    // cancel edit
    dirEditingId = null;
    clearAddForm();
    document.getElementById('directory-add-btn').textContent = '+ Add Entry';
  }
  form.style.display = open ? 'none' : '';
  if (!open) setTimeout(() => document.getElementById('dir-add-name').focus(), 60);
}

function clearAddForm() {
  document.getElementById('dir-add-name').value = '';
  document.getElementById('dir-add-location').value = '';
  document.getElementById('dir-add-category').value = '';
}

function editDirectoryEntry(id) {
  const entry = dirCustom.find(e => e.id === id);
  if (!entry) return;
  dirEditingId = id;
  const form = document.getElementById('directory-add-form');
  form.style.display = '';
  document.getElementById('dir-add-name').value = entry.name;
  document.getElementById('dir-add-location').value = entry.location;
  document.getElementById('dir-add-category').value = entry.category || '';
  document.getElementById('directory-add-btn').textContent = '✕ Cancel Edit';
  setTimeout(() => document.getElementById('dir-add-name').focus(), 60);
}

function submitDirectoryEntry() {
  const name = document.getElementById('dir-add-name').value.trim();
  const location = document.getElementById('dir-add-location').value.trim();
  const category = document.getElementById('dir-add-category').value.trim() || null;

  const nameEl = document.getElementById('dir-add-name');
  const locEl = document.getElementById('dir-add-location');
  if (!name) { nameEl.classList.add('input-shake'); setTimeout(() => nameEl.classList.remove('input-shake'), 400); nameEl.focus(); return; }
  if (!location) { locEl.classList.add('input-shake'); setTimeout(() => locEl.classList.remove('input-shake'), 400); locEl.focus(); return; }

  if (dirEditingId) {
    const idx = dirCustom.findIndex(e => e.id === dirEditingId);
    if (idx !== -1) dirCustom[idx] = { ...dirCustom[idx], name, location, category };
    dirEditingId = null;
    document.getElementById('directory-add-btn').textContent = '+ Add Entry';
  } else {
    dirCustom.push({ id: 'c_' + Date.now(), name, location, category });
  }

  saveDirectoryEdits();
  syncDirectoryToServer();
  clearAddForm();
  document.getElementById('directory-add-form').style.display = 'none';
  populateDirectoryCategoryDropdown();
  filterDirectory();
  toast(`Saved: ${name}`);
}

function confirmRemoveDirectoryEntry(name, customId) {
  showConfirmDelete(`Remove "${name}" from the directory?`, () => removeDirectoryEntry(name, customId));
}

function removeDirectoryEntry(name, customId) {
  if (customId) {
    dirCustom = dirCustom.filter(e => e.id !== customId);
  } else {
    dirHidden.add(name);
  }
  saveDirectoryEdits();
  syncDirectoryToServer();
  populateDirectoryCategoryDropdown();
  filterDirectory();
}

function filterDirectory() {
  const query = document.getElementById('directory-search').value.trim().toLowerCase();
  const cat = document.getElementById('directory-category').value;
  const resultsEl = document.getElementById('directory-results');
  const infoEl = document.getElementById('directory-results-info');

  if (!query && !cat) {
    resultsEl.innerHTML = '<div class="directory-empty">Enter a name or select a category to search.</div>';
    infoEl.textContent = '';
    return;
  }

  let results = buildDirectoryView();
  if (cat) results = results.filter(e => e.category === cat);
  if (query) results = results.filter(e =>
    e.name.toLowerCase().includes(query) || e.location.toLowerCase().includes(query)
  );

  const total = results.length;
  if (total === 0) {
    const hint = cat && query ? ` in "${cat}"` : cat ? ` in "${cat}"` : '';
    infoEl.textContent = '';
    resultsEl.innerHTML = `<div class="directory-empty">No entries found${hint}.</div>`;
    return;
  }

  const MAX = 200;
  infoEl.textContent = `${total} result${total===1?'':'s'}${total > MAX ? ` — showing first ${MAX}` : ''}`;

  let html = results.slice(0, MAX).map(e => {
    const name = escapeHtml(e.name);
    const loc = escapeHtml(e.location);
    const isCustom = !!e.id;
    const catLabel = e.category ? `<span class="directory-entry-category">${escapeHtml(e.category)}</span>` : '';
    const customBadge = isCustom ? `<span class="directory-custom-badge" title="Custom entry">★</span>` : '';
    const ename = escapeHtml(JSON.stringify(e.name));
    const gmBtns = isGM ? `<span class="directory-entry-actions">${
      isCustom ? `<button class="directory-action-btn" onclick="editDirectoryEntry(${escapeHtml(JSON.stringify(e.id))})" title="Edit">✎</button>` : ''
    }<button class="directory-action-btn directory-delete-btn" onclick="confirmRemoveDirectoryEntry(${ename},${isCustom ? escapeHtml(JSON.stringify(e.id)) : 'null'})" title="Remove">✕</button></span>` : '';
    return `<div class="directory-entry">${customBadge}<span class="directory-entry-name">${name}</span><span class="directory-dots" aria-hidden="true"></span>${catLabel}<span class="directory-entry-location">${loc}</span>${gmBtns}</div>`;
  }).join('');
  resultsEl.innerHTML = html;
}

let allClues = [];
let allPlayers = [];
let allNotes = [];
let playerSubscription = null;
let gmSubscription = null;
let gmPresenceChannel = null;
let playerPresenceChannel = null;
let presenceOnline = new Set(); // "name|color" keys of currently-online players
let isGM = false;

// ── UTILS ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function setMastheadCase(name) {
  // kept for call-site compatibility; masthead now shows static app title
}
function copyInviteCode() {
  const code = document.getElementById('gm-invite-code-text').textContent;
  if (!code || code === '—') return;
  navigator.clipboard.writeText(code).then(() => toast('Code copied: ' + code));
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── GM AUTH ──
function showGMLogin() { openModal('modal-gm-login'); }

function resetGMPassword() {
  if (!confirm('Reset GM password? You will need to set a new one on next login.')) return;
  store.remove(GM_PASSWORD_KEY);
  store.remove(GM_SESSION_KEY);
  document.getElementById('gm-login-error').textContent = 'Password reset. Enter a new password to set it.';
}

function setGMPassword() {
  const pw = document.getElementById('gm-new-password').value.trim();
  if (!pw) return;
  store.set(GM_PASSWORD_KEY, pw);
  toast('Password set!');
  document.getElementById('gm-new-password').value = '';
}

function doGMLogin() {
  const pw = document.getElementById('gm-password-input').value.trim();
  if (!pw) { document.getElementById('gm-login-error').textContent = 'Enter a password.'; return; }
  const stored = store.get(GM_PASSWORD_KEY);
  if (!stored) {
    store.set(GM_PASSWORD_KEY, pw);
    store.set(GM_SESSION_KEY, '1');
    closeModal('modal-gm-login');
    enterGM();
    toast('Password set. Welcome, Game Master.');
    return;
  }
  if (pw !== stored) { document.getElementById('gm-login-error').textContent = 'Incorrect password.'; return; }
  store.set(GM_SESSION_KEY, '1');
  closeModal('modal-gm-login');
  enterGM();
}

function mastheadLogout() {
  if (isGM) { gmLogout(); } else { playerLogout(); }
}
function playerLogout() {
  if (kickSubscription) sb.removeChannel(kickSubscription);
  if (playerPresenceChannel) sb.removeChannel(playerPresenceChannel);
  location.reload();
}
function gmLogout() {
  if (gmSubscription) sb.removeChannel(gmSubscription);
  if (gmPresenceChannel) sb.removeChannel(gmPresenceChannel);
  store.remove(GM_SESSION_KEY);
  location.reload();
}
function showMastheadLogout() {
  const btn = document.getElementById('masthead-logout-btn');
  if (btn) btn.style.display = '';
}

async function enterGM() {
  isGM = true;
  document.getElementById('mode-indicator').innerHTML = '<span class="mode-badge gm">Game Master</span>';
  showMastheadLogout();
  showScreen('gm-screen');
  await loadMapsLibrary();
  await loadCases();
}

// ── CASES ──
async function loadCases() {
  const { data } = await sb.from('cases').select('*').order('created_at');
  casesCache = data || [];
  const sel = document.getElementById('case-select');
  sel.innerHTML = '<option value="">— Select a Case —</option>';
  casesCache.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function showNewCase() { openModal('modal-new-case'); }

async function createCase() {
  const name = document.getElementById('new-case-name').value.trim();
  if (!name) { document.getElementById('new-case-error').textContent = 'Enter a case name.'; return; }
  const description = document.getElementById('new-case-description').value.trim();
  const { data, error } = await sb.from('cases').insert({ name, description }).select().single();
  if (error) { document.getElementById('new-case-error').textContent = error.message; return; }
  closeModal('modal-new-case');
  document.getElementById('new-case-name').value = '';
  document.getElementById('new-case-description').value = '';
  await loadCases();
  document.getElementById('case-select').value = data.id;
  onCaseChange();
}

async function onCaseChange() {
  const sel = document.getElementById('case-select');
  currentCaseId = sel.value;
  currentCaseName = sel.options[sel.selectedIndex]?.text;
  setMastheadCase(currentCaseId ? currentCaseName : "");
  document.getElementById('delete-case-btn').style.display = currentCaseId ? '' : 'none';
  if (!currentCaseId) {
    document.getElementById('share-box').style.display = 'none';
    document.getElementById('gm-content').innerHTML = '<div class="empty-state">Select or create a case to begin.</div>';
    const rp = document.getElementById('gm-right-panel');
    if (rp) rp.style.display = 'none';
    return;
  }
  const caseData = casesCache.find(c => c.id === currentCaseId);
  currentCaseDescription = caseData?.description || '';
  currentMapId = caseData?.map_id || null;
  currentMapUrl = currentMapId ? (mapsLibrary.find(m => m.id === currentMapId)?.url || '') : '';
  // Update GM sidebar map/directory buttons
  const gmWrap = document.getElementById('gm-map-btn-wrap');
  if (gmWrap) gmWrap.style.display = currentMapUrl ? '' : 'none';
  const gmDirWrap = document.getElementById('gm-directory-btn-wrap');
  if (gmDirWrap) gmDirWrap.style.display = '';
  // Share link + invite code block
  const shareUrl = `${location.href.split('?')[0]}?case=${currentCaseId}`;
  document.getElementById('share-url').textContent = shareUrl;
  document.getElementById('share-box').style.display = 'inline-flex';
  // Show first 8 chars of UUID as the display code; full UUID used for join
  const codeText = currentCaseId.split('-')[0].toUpperCase();
  const codeEl = document.getElementById('gm-invite-code-text');
  if (codeEl) codeEl.textContent = codeText;
  const inviteBlock = document.getElementById('gm-invite-block');
  if (inviteBlock) inviteBlock.style.display = '';
  const inviteDivider = document.getElementById('gm-invite-divider');
  if (inviteDivider) inviteDivider.style.display = '';
  await Promise.all([loadDirectoryFromServer(currentCaseId), loadGMClues()]);
  subscribeGMUpdates(currentCaseId);
}

function gmBriefingHTML() {
  const desc = currentCaseDescription;
  return `<div class="case-briefing-panel" id="gm-briefing-panel">
    <div class="briefing-header" onclick="toggleBriefing('gm-briefing-body')">
      <span>Case Briefing</span><span id="gm-briefing-toggle" class="briefing-toggle">▸</span>
    </div>
    <div id="gm-briefing-body" class="briefing-body" style="display:none">
      <div id="gm-briefing-display" style="${desc ? '' : 'display:none'}">
        <p class="briefing-text" id="gm-briefing-text">${desc ? escapeHtml(desc) : ''}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="showGMBriefingEdit()">✏️ Edit Briefing</button>
      </div>
      <div id="gm-briefing-edit" style="${desc ? 'display:none' : ''}">
        <textarea id="gm-briefing-input" rows="12" placeholder="Set the scene — the crime, the setting, what the investigators know at the outset…" style="width:100%;resize:vertical;min-height:200px;font-family:'IM Fell English',Georgia,serif;font-size:0.95rem;line-height:1.7;background:var(--paper);color:var(--ink);border:1px solid var(--parchment-darker);padding:12px 14px;border-radius:2px;box-sizing:border-box;">${desc ? escapeHtml(desc) : ''}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="saveGMBriefing()">Save</button>
          ${desc ? '<button class="btn btn-secondary btn-sm" onclick="cancelGMBriefingEdit()">Cancel</button>' : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function gmMapHTML() {
  const selected = mapsLibrary.find(m => m.id === currentMapId);
  const options = mapsLibrary.map(m =>
    `<option value="${m.id}" ${m.id === currentMapId ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
  ).join('');
  return `<div class="case-briefing-panel" style="margin-bottom:24px;">
    <div class="briefing-header" onclick="toggleBriefing('gm-map-body')">
      <span>Case Map</span><span id="gm-map-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="gm-map-body" class="briefing-body">
      ${selected ? `<img src="${selected.url}" alt="${escapeHtml(selected.name)}" style="max-width:100%;border:1px solid var(--parchment-darker);cursor:pointer;margin-bottom:12px;display:block;" onclick="openMapFullscreen()">` : '<p style="font-family:\'Courier New\',Courier,monospace;font-size:0.85rem;color:var(--fog);margin:0 0 12px;">No map attached to this case.</p>'}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="case-map-select" style="font-family:\'Courier New\',Courier,monospace;font-size:0.85rem;background:var(--ink);color:var(--parchment);border:1px solid var(--parchment-darker);padding:6px 8px;border-radius:2px;" onchange="attachMapToCase(this.value)">
          <option value="">— No map —</option>
          ${options}
        </select>
        ${selected ? `<button class="btn btn-secondary btn-sm" onclick="openMapFullscreen()">⤢ Fullscreen</button>` : ''}
      </div>
    </div>
  </div>`;
}

function gmPlayersHTML() {
  const active = allPlayers.filter(p => !p.is_kicked);
  const kicked = allPlayers.filter(p => p.is_kicked);
  const rowStyle = 'display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(201,169,110,0.12);';
  const nameStyle = `font-family:'Courier New',Courier,monospace;font-size:0.82rem;color:var(--parchment);flex:1;`;

  const playerRow = (p, isKicked) => `
    <div style="${rowStyle}">
      <div style="width:10px;height:10px;border-radius:50%;background:${p.player_color};flex-shrink:0;border:1px solid rgba(255,255,255,0.2);"></div>
      <span style="${nameStyle}${isKicked ? 'opacity:0.45;text-decoration:line-through;' : ''}">${escapeHtml(p.player_name)}</span>
      ${isKicked
        ? `<button class="btn btn-secondary btn-sm" onclick="unkickPlayer('${p.id}')">Reinstate</button>
           <button class="btn btn-danger btn-sm" onclick="deletePlayerData('${p.id}','${escapeHtml(p.player_name)}','${p.player_color}')">Delete</button>`
        : `<button class="btn btn-danger btn-sm" onclick="kickPlayer('${p.id}')">Kick</button>`}
    </div>`;

  const body = !allPlayers.length
    ? `<p style="font-family:'Courier New',Courier,monospace;font-size:0.8rem;color:var(--fog);margin:0;">No players have joined yet.</p>`
    : `${active.map(p => playerRow(p, false)).join('')}
       ${kicked.length ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(201,169,110,0.2);">
         <div style="font-family:'Courier New',Courier,monospace;font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--fog);margin-bottom:6px;">Removed</div>
         ${kicked.map(p => playerRow(p, true)).join('')}
       </div>` : ''}`;

  return `<div class="case-briefing-panel" style="margin-bottom:24px;">
    <div class="briefing-header" onclick="toggleBriefing('gm-players-body')">
      <span>Players <span class="counter-badge">${active.length}</span></span>
      <span id="gm-players-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="gm-players-body" class="briefing-body" style="padding:10px 16px;">
      ${body}
    </div>
  </div>`;
}

async function kickPlayer(id) {
  await sb.from('players').update({ is_kicked: true }).eq('id', id);
  await loadGMClues();
  toast('Player removed.');
}

async function unkickPlayer(id) {
  await sb.from('players').update({ is_kicked: false }).eq('id', id);
  await loadGMClues();
  toast('Player reinstated.');
}

async function deletePlayerData(id, name, color) {
  if (!confirm(`Delete all data for "${name}"? This removes their notes and cannot be undone.`)) return;
  await sb.from('notes').delete().eq('case_id', currentCaseId).eq('player_name', name).eq('player_color', color);
  await sb.from('players').delete().eq('id', id);
  await loadGMClues();
  toast('Player data deleted.');
}

function subscribeGMUpdates(caseId) {
  if (gmSubscription) sb.removeChannel(gmSubscription);
  gmSubscription = sb.channel('gm-live-' + caseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clues', filter: `case_id=eq.${caseId}` },
      () => debouncedLoadGMClues())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `case_id=eq.${caseId}` },
      () => debouncedLoadGMRightPanel())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `case_id=eq.${caseId}` },
      () => debouncedLoadGMRightPanel())
    .subscribe();

  if (gmPresenceChannel) sb.removeChannel(gmPresenceChannel);
  gmPresenceChannel = sb.channel('presence-' + caseId);
  gmPresenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = gmPresenceChannel.presenceState();
      presenceOnline = new Set(
        Object.values(state).flat().map(p => p.player_name + '|' + p.player_color)
      );
      renderGMRightPanel();
    })
    .subscribe();
}

async function attachMapToCase(mapId) {
  const { error } = await sb.from('cases').update({ map_id: mapId || null }).eq('id', currentCaseId);
  if (error) { toast('Error saving map selection.'); return; }
  currentMapId = mapId || null;
  currentMapUrl = mapsLibrary.find(m => m.id === mapId)?.url || '';
  toast('Map updated.');
  renderGMClues();
}

async function loadMapsLibrary() {
  const { data } = await sb.from('maps').select('*').order('created_at');
  mapsLibrary = data || [];
}

async function showMapsLibrary() {
  await loadMapsLibrary();
  renderMapsLibraryModal();
  openModal('modal-maps-library');
}

function renderMapsLibraryModal() {
  const grid = document.getElementById('maps-library-grid');
  if (!mapsLibrary.length) {
    grid.innerHTML = '<p style="font-family:\'Courier New\',Courier,monospace;font-size:0.85rem;color:var(--fog);">No maps uploaded yet.</p>';
    return;
  }
  grid.innerHTML = mapsLibrary.map(m => `
    <div style="border:1px solid var(--parchment-darker);overflow:hidden;border-radius:2px;">
      <img src="${m.url}" alt="${escapeHtml(m.name)}" style="width:100%;height:140px;object-fit:cover;display:block;cursor:pointer;" onclick="openMapPreview('${m.url}')">
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px;">
        <input id="map-name-${m.id}" type="text" value="${escapeHtml(m.name)}" style="width:100%;font-family:'Courier New',Courier,monospace;font-size:0.78rem;background:rgba(244,232,206,0.08);border:1px solid rgba(139,105,20,0.3);color:var(--parchment);padding:4px 6px;box-sizing:border-box;border-radius:2px;">
        <div style="display:flex;gap:4px;align-items:center;">
          <label style="font-family:'Courier New',Courier,monospace;font-size:0.68rem;color:var(--fog);cursor:pointer;flex:1;border:1px solid rgba(139,105,20,0.3);padding:3px 6px;text-align:center;border-radius:2px;" title="Replace image file">
            ↑ Replace img
            <input type="file" accept="image/*" style="display:none;" onchange="replaceMapImage('${m.id}', this)">
          </label>
          <button class="btn btn-secondary btn-sm" style="font-size:0.65rem;padding:3px 7px;" onclick="renameMap('${m.id}')">Rename</button>
          <button class="btn btn-danger btn-sm" style="font-size:0.65rem;padding:3px 7px;" onclick="deleteMap('${m.id}')">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

async function uploadLibraryMap() {
  const nameEl = document.getElementById('new-map-name');
  const fileEl = document.getElementById('new-map-file');
  const errEl = document.getElementById('maps-library-error');
  const name = nameEl.value.trim();
  const file = fileEl.files[0];
  if (!name) { errEl.textContent = 'Enter a map name.'; return; }
  if (!file) { errEl.textContent = 'Select an image.'; return; }
  errEl.textContent = 'Uploading…';
  const ext = file.name.split('.').pop();
  const path = `maps/${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('clues').upload(path, file);
  if (upErr) { errEl.textContent = upErr.message; return; }
  const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
  const { error: dbErr } = await sb.from('maps').insert({ name, url: urlData.publicUrl });
  if (dbErr) { errEl.textContent = dbErr.message; return; }
  nameEl.value = '';
  fileEl.value = '';
  errEl.textContent = '';
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map added to library!');
}

async function deleteMap(id) {
  if (!confirm('Remove this map from the library?')) return;
  await sb.from('maps').delete().eq('id', id);
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map removed.');
}

async function renameMap(id) {
  const input = document.getElementById('map-name-' + id);
  const name = input?.value.trim();
  if (!name) { toast('Enter a name first.'); return; }
  const { error } = await sb.from('maps').update({ name }).eq('id', id);
  if (error) { toast('Error renaming map.'); return; }
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map renamed.');
}

async function replaceMapImage(id, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop();
  const path = `maps/${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('clues').upload(path, file);
  if (upErr) { toast('Upload failed: ' + upErr.message); return; }
  const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
  const { error: dbErr } = await sb.from('maps').update({ url: urlData.publicUrl }).eq('id', id);
  if (dbErr) { toast('Error updating map.'); return; }
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map image replaced.');
}

function openMapPreview(url) {
  sizeMapCanvas();
  openModal('modal-map');
  mapImg = new Image();
  mapImg.onload = () => {
    mapFitScale = calcMapFitScale(mapImg);
    mapScale = mapFitScale; mapX = 0; mapY = 0;
    drawMapCanvas();
  };
  mapImg.src = url;
}

// ── MAP CANVAS RENDERER ──
// Uses canvas + ctx.drawImage with source clipping instead of CSS transform.
// This avoids GPU texture size limits that cause black tiles on high zoom.
let mapScale = 1, mapFitScale = 1, mapX = 0, mapY = 0;
let mapDragging = false, mapDragStart = null, mapDidMove = false;
let mapImg = null;

function drawMapCanvas() {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!mapImg || !mapImg.complete || !mapImg.naturalWidth) return;

  const iw = mapImg.naturalWidth, ih = mapImg.naturalHeight;
  const drawW = iw * mapScale, drawH = ih * mapScale;
  // Top-left corner of the image in canvas coordinates
  const drawX = (canvas.width  - drawW) / 2 + mapX;
  const drawY = (canvas.height - drawH) / 2 + mapY;

  // Clamp source rect to only the visible portion — never rasterises off-screen pixels
  const srcX = Math.max(0, -drawX / mapScale);
  const srcY = Math.max(0, -drawY / mapScale);
  const srcW = Math.min(iw - srcX, canvas.width  / mapScale);
  const srcH = Math.min(ih - srcY, canvas.height / mapScale);
  if (srcW <= 0 || srcH <= 0) return;

  const dstX = Math.max(0, drawX);
  const dstY = Math.max(0, drawY);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mapImg, srcX, srcY, srcW, srcH, dstX, dstY, srcW * mapScale, srcH * mapScale);
}

function sizeMapCanvas() {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function mapZoom(factor, pivotX = 0, pivotY = 0) {
  const newScale = Math.min(mapFitScale * 20, Math.max(mapFitScale * 0.9, mapScale * factor));
  const ratio = newScale / mapScale;
  mapX = pivotX + (mapX - pivotX) * ratio;
  mapY = pivotY + (mapY - pivotY) * ratio;
  mapScale = newScale;
  drawMapCanvas();
}

function mapZoomReset() {
  mapScale = mapFitScale; mapX = 0; mapY = 0;
  drawMapCanvas();
}

function calcMapFitScale(img) {
  return Math.min(window.innerWidth / img.naturalWidth, window.innerHeight / img.naturalHeight, 1);
}

(function initMapInteraction() {
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modal-map');

    window.addEventListener('resize', () => {
      if (overlay.classList.contains('open')) { sizeMapCanvas(); drawMapCanvas(); }
    });

    overlay.addEventListener('wheel', e => {
      if (!overlay.classList.contains('open')) return;
      e.preventDefault();
      const canvas = document.getElementById('map-canvas');
      const rect = canvas.getBoundingClientRect();
      // Zoom towards cursor position
      const px = e.clientX - rect.left - canvas.width  / 2;
      const py = e.clientY - rect.top  - canvas.height / 2;
      mapZoom(e.deltaY < 0 ? 1.15 : 0.87, px, py);
    }, { passive: false });

    overlay.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      mapDragging = true; mapDidMove = false;
      mapDragStart = { x: e.clientX - mapX, y: e.clientY - mapY };
      overlay.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!mapDragging) return;
      mapDidMove = true;
      mapX = e.clientX - mapDragStart.x;
      mapY = e.clientY - mapDragStart.y;
      drawMapCanvas();
    });

    window.addEventListener('mouseup', e => {
      if (mapDragging && !mapDidMove && !e.target.closest('button')) closeModal('modal-map');
      mapDragging = false;
      overlay.style.cursor = 'grab';
    });

    // Touch pinch-to-zoom
    let lastTouchDist = null, lastTouchMid = null;
    overlay.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        lastTouchMid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
      } else if (e.touches.length === 1) {
        mapDragging = true;
        mapDragStart = { x: e.touches[0].clientX - mapX, y: e.touches[0].clientY - mapY };
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && lastTouchDist) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        const canvas = document.getElementById('map-canvas');
        const px = mid.x - canvas.width / 2, py = mid.y - canvas.height / 2;
        mapZoom(dist / lastTouchDist, px, py);
        lastTouchDist = dist; lastTouchMid = mid;
      } else if (e.touches.length === 1 && mapDragging) {
        mapX = e.touches[0].clientX - mapDragStart.x;
        mapY = e.touches[0].clientY - mapDragStart.y;
        drawMapCanvas();
      }
    }, { passive: true });

    overlay.addEventListener('touchend', () => { mapDragging = false; lastTouchDist = null; });
  });
})();

let sidebarOpen = false;
let gmSidebarOpen = false;
const gmMinimizedNotes = new Set();
function toggleGMSidebarNote(id) {
  if (gmMinimizedNotes.has(id)) gmMinimizedNotes.delete(id);
  else gmMinimizedNotes.add(id);
  renderGMRightPanel();
}
function gmNotebookBtnClick() {
  const modal = document.getElementById('modal-gm-notebook');
  modal.style.display = 'flex';
  renderGMNotebookModal();
}
function closeGMNotebook() {
  document.getElementById('modal-gm-notebook').style.display = 'none';
}
function renderGMNotebookModal() {
  const inner = document.getElementById('modal-gm-notebook-inner');
  if (!inner) return;
  inner.innerHTML = buildGMNotebookHTML('gm-modal-nb');
}

function togglePlayerSidebar() {
  sidebarOpen = !sidebarOpen;
  const sidebar = document.getElementById('player-sidebar');
  if (sidebarOpen) {
    sidebar.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('sidebar-open');
  }
}

function toggleGMSidebar() {
  gmSidebarOpen = !gmSidebarOpen;
  const sidebar = document.getElementById('gm-sidebar');
  sidebar.classList.toggle('sidebar-open', gmSidebarOpen);
  // Re-render notes so they show/hide with sidebar width
  renderGMRightPanel();
}

function toggleGMBriefing() {
  const panel = document.getElementById('gm-briefing-panel');
  if (!panel) return;
  const body = document.getElementById('gm-briefing-body');
  const toggle = document.getElementById('gm-briefing-toggle');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (toggle) toggle.textContent = open ? '▸' : '▾';
  // If opening and no briefing text yet, go straight to edit mode
  if (!open && !currentCaseDescription) {
    document.getElementById('gm-briefing-display').style.display = 'none';
    document.getElementById('gm-briefing-edit').style.display = '';
  }
  // Scroll into view
  if (!open) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openMapFullscreen() {
  if (!currentMapUrl) return;
  sizeMapCanvas();
  openModal('modal-map');
  const ready = () => {
    mapFitScale = calcMapFitScale(mapImg);
    mapScale = mapFitScale; mapX = 0; mapY = 0;
    drawMapCanvas();
  };
  if (mapImg && mapImg.src === currentMapUrl && mapImg.complete && mapImg.naturalWidth) {
    ready();
  } else {
    mapImg = new Image();
    mapImg.onload = ready;
    mapImg.src = currentMapUrl;
  }
}

function renderPlayerMap() {
  const wrap = document.getElementById('player-map-btn-wrap');
  if (wrap) wrap.style.display = currentMapUrl ? '' : 'none';
  const gmWrap = document.getElementById('gm-map-btn-wrap');
  if (gmWrap) gmWrap.style.display = currentMapUrl ? '' : 'none';
  const pDirWrap = document.getElementById('player-directory-btn-wrap');
  if (pDirWrap) pDirWrap.style.display = '';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleBriefing(bodyId) {
  const body = document.getElementById(bodyId);
  const toggleId = bodyId === 'gm-briefing-body' ? 'gm-briefing-toggle'
    : bodyId === 'gm-map-body' ? 'gm-map-toggle'
    : bodyId === 'gm-players-body' ? 'gm-players-toggle'
    : bodyId === 'gm-notes-body' ? 'gm-notes-toggle'
    : 'player-briefing-toggle';
  const toggle = document.getElementById(toggleId);
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (toggle) toggle.textContent = open ? '▸' : '▾';
}

function showGMBriefingEdit() {
  document.getElementById('gm-briefing-display').style.display = 'none';
  document.getElementById('gm-briefing-edit').style.display = '';
  document.getElementById('gm-briefing-input').value = currentCaseDescription;
}

function cancelGMBriefingEdit() {
  document.getElementById('gm-briefing-edit').style.display = 'none';
  document.getElementById('gm-briefing-display').style.display = '';
}

async function saveGMBriefing() {
  const text = document.getElementById('gm-briefing-input').value.trim();
  const { error } = await sb.from('cases').update({ description: text }).eq('id', currentCaseId);
  if (error) { toast('Error saving briefing.'); return; }
  currentCaseDescription = text;
  document.getElementById('gm-briefing-text').textContent = text;
  if (text) {
    document.getElementById('gm-briefing-display').style.display = '';
    document.getElementById('gm-briefing-edit').style.display = 'none';
  }
  toast('Briefing saved.');
}

function copyShareLink() {
  const url = document.getElementById('share-url').textContent;
  navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
}

// ── GM CLUES ──
let _loadGMCluesTimer = null;
function debouncedLoadGMClues() {
  clearTimeout(_loadGMCluesTimer);
  _loadGMCluesTimer = setTimeout(loadGMClues, 150);
}
let _loadGMRightPanelTimer = null;
function debouncedLoadGMRightPanel() {
  clearTimeout(_loadGMRightPanelTimer);
  _loadGMRightPanelTimer = setTimeout(async () => {
    const [playersRes, notesRes] = await Promise.all([
      sb.from('players').select('*').eq('case_id', currentCaseId).order('joined_at'),
      sb.from('notes').select('*').eq('case_id', currentCaseId).order('created_at'),
    ]);
    allPlayers = playersRes.data || [];
    allNotes = notesRes.data || [];
    renderGMRightPanel();
  }, 150);
}
async function loadGMClues() {
  const [cluesRes, playersRes, notesRes] = await Promise.all([
    sb.from('clues').select('*').eq('case_id', currentCaseId).order('position'),
    sb.from('players').select('*').eq('case_id', currentCaseId).order('joined_at'),
    sb.from('notes').select('*').eq('case_id', currentCaseId).order('created_at'),
  ]);
  allClues = cluesRes.data || [];
  allPlayers = playersRes.data || [];
  allNotes = notesRes.data || [];
  renderGMClues();
}

function renderGMClues() {
  const revealed = allClues.filter(c => c.revealed);
  const unrevealed = allClues.filter(c => !c.revealed);

  // Briefing panel + clue grids go into #gm-content
  let html = gmBriefingHTML();

  // Unrevealed
  html += `<div class="clues-section-title" style="color:var(--parchment)">Unrevealed <span class="counter-badge">${unrevealed.length}</span></div>`;
  html += '<div class="clues-grid">';
  unrevealed.forEach(c => {
    const thumb = c.clue_text
      ? `<div class="clue-thumb-text">${c.clue_text}</div>`
      : `<img class="clue-thumb" src="${c.image_url}" alt="${c.location_name}">`;
    html += `<div class="clue-card" onclick="openGMCluePreview(${JSON.stringify(c).replace(/"/g, '&quot;')})">
      ${thumb}
      <div class="clue-label">${c.location_name}</div>
      <div class="clue-actions">
        <button class="clue-action-btn reveal" onclick="event.stopPropagation();revealClue('${c.id}')">👁 Reveal</button>
        <button class="clue-action-btn edit" onclick="event.stopPropagation();showEditClue('${c.id}')">✏️ Edit</button>
        <button class="clue-action-btn del" onclick="event.stopPropagation();deleteClue('${c.id}')">🗑 Delete</button>
      </div>
    </div>`;
  });
  html += `<div class="clue-add-card" onclick="showAddClue()">
    <span class="clue-add-icon">+</span>
    <span>Add Clue</span>
  </div>`;
  html += '</div>';

  // Revealed
  if (revealed.length) {
    html += `<div class="clues-section-title" style="color:var(--parchment);margin-top:8px">Revealed <span class="counter-badge">${revealed.length}</span></div>`;
    html += '<div class="clues-grid">';
    revealed.forEach(c => {
      const thumb = c.clue_text
        ? `<div class="clue-thumb-text">${c.clue_text}</div>`
        : `<img class="clue-thumb" src="${c.image_url}" alt="${c.location_name}">`;
      html += `<div class="clue-card revealed" onclick="openGMCluePreview(${JSON.stringify(c).replace(/"/g, '&quot;')})">
        ${thumb}
        <div class="clue-label">${c.location_name}</div>
        <div class="clue-actions">
          <button class="clue-action-btn hide" onclick="event.stopPropagation();unrevealClue('${c.id}')">🚫 Hide</button>
          <button class="clue-action-btn edit" onclick="event.stopPropagation();showEditClue('${c.id}')">✏️ Edit</button>
          <button class="clue-action-btn del" onclick="event.stopPropagation();deleteClue('${c.id}')">🗑 Delete</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  document.getElementById('gm-content').innerHTML = html;

  // Update GM sidebar map/directory button visibility
  const gmWrap = document.getElementById('gm-map-btn-wrap');
  if (gmWrap) gmWrap.style.display = currentMapUrl ? '' : 'none';
  const gmDirWrap2 = document.getElementById('gm-directory-btn-wrap');
  if (gmDirWrap2) gmDirWrap2.style.display = '';

  // Show right panel and render players + notes there
  const rightPanel = document.getElementById('gm-right-panel');
  if (rightPanel) rightPanel.style.display = '';
  renderGMRightPanel();
}

let gmPlayersPanelOpen = true;
function toggleGMPlayersPanel() {
  gmPlayersPanelOpen = !gmPlayersPanelOpen;
  const el = document.getElementById('gm-right-players');
  const btn = document.getElementById('gm-players-minimize-btn');
  if (el) el.style.display = gmPlayersPanelOpen ? '' : 'none';
  if (btn) btn.textContent = gmPlayersPanelOpen ? '▾' : '▸';
}

function renderGMRightPanel() {
  // Players section — with online presence dot
  const active = allPlayers.filter(p => !p.is_kicked);
  const kicked = allPlayers.filter(p => p.is_kicked);
  const rowStyle = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(201,169,110,0.12);';
  const nameStyle = `font-family:'Courier New',Courier,monospace;font-size:0.78rem;color:var(--parchment);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;

  const onlineDot = (p) => {
    const online = presenceOnline.has(p.player_name + '|' + p.player_color);
    return `<div style="width:6px;height:6px;border-radius:50%;background:${online ? '#4caf50' : 'rgba(255,255,255,0.15)'};flex-shrink:0;box-shadow:${online ? '0 0 4px #4caf50' : 'none'};" title="${online ? 'Online' : 'Offline'}"></div>`;
  };

  const playerRow = (p, isKicked) => `
    <div style="${rowStyle}">
      ${isKicked ? '' : onlineDot(p)}
      <div style="width:8px;height:8px;border-radius:50%;background:${p.player_color};flex-shrink:0;border:1px solid rgba(255,255,255,0.2);"></div>
      <span style="${nameStyle}${isKicked ? 'opacity:0.45;text-decoration:line-through;' : ''}">${escapeHtml(p.player_name)}</span>
      ${isKicked
        ? `<button class="btn btn-secondary btn-sm" onclick="unkickPlayer('${p.id}')" style="font-size:0.6rem;padding:3px 6px;">Reinstate</button>
           <button class="btn btn-danger btn-sm" onclick="deletePlayerData('${p.id}','${escapeHtml(p.player_name)}','${p.player_color}')" style="font-size:0.6rem;padding:3px 6px;">Del</button>`
        : `<button class="btn btn-danger btn-sm" onclick="kickPlayer('${p.id}')" style="font-size:0.6rem;padding:3px 6px;">Kick</button>`}
    </div>`;

  const playersBody = !allPlayers.length
    ? `<p style="font-family:'Courier New',Courier,monospace;font-size:0.75rem;color:var(--fog);margin:0;font-style:italic;">No players yet.</p>`
    : `${active.map(p => playerRow(p, false)).join('')}
       ${kicked.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(201,169,110,0.2);">
         <div style="font-family:'Courier New',Courier,monospace;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--fog);margin-bottom:4px;">Removed</div>
         ${kicked.map(p => playerRow(p, true)).join('')}
       </div>` : ''}`;

  const playersBadge = document.getElementById('gm-players-badge');
  if (playersBadge) playersBadge.textContent = active.length;
  const playersEl = document.getElementById('gm-right-players');
  if (playersEl) {
    playersEl.innerHTML = playersBody;
    playersEl.style.display = gmPlayersPanelOpen ? '' : 'none';
  }

  // Notes — badge only, full render happens in modal on demand
  const notesBadgeEl = document.getElementById('gm-sidebar-notes-badge');
  if (notesBadgeEl) {
    notesBadgeEl.style.display = gmSidebarOpen ? '' : 'none';
    notesBadgeEl.textContent = allNotes.length + (allNotes.length === 1 ? ' note' : ' notes');
  }
  // Refresh modal if open
  const modal = document.getElementById('modal-gm-notebook');
  if (modal && modal.style.display !== 'none') renderGMNotebookModal();
}

function renderGMNotesFeed(notes) {
  if (!notes.length) {
    return `<div style="font-family:'Courier Prime','Courier New',monospace;font-size:0.72rem;color:rgba(60,35,5,0.45);font-style:italic;padding:6px 0;">No notes yet.</div>`;
  }
  return notes.map(n => {
    const time = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="nb-note">
      <div class="nb-note-meta">
        <span class="nb-note-name" style="color:${n.player_color};">${escapeHtml(n.player_name)}</span>
        <span class="nb-note-time">${time}</span>
        <span class="nb-note-actions">
          <button class="nb-note-action danger" title="Delete" onclick="gmDeleteNote('${n.id}')">✕</button>
        </span>
      </div>
      <div class="nb-note-text" style="color:#0e0600;">${escapeHtml(n.content)}</div>
    </div>`;
  }).join('');
}

function buildGMNotebookHTML(prefix) {
  const playerNames = [...new Set(allNotes.map(n => n.player_name))];
  const allTabId = `${prefix}-tab-0`;
  const playerTabIds = playerNames.map((_, i) => `${prefix}-tab-${i + 1}`);

  let radios = `<input type="radio" name="${prefix}" id="${allTabId}" class="nb-radio" checked>`;
  playerTabIds.forEach(id => { radios += `<input type="radio" name="${prefix}" id="${id}" class="nb-radio">`; });

  let tabLabels = `<label class="nb-tab" for="${allTabId}">All</label>`;
  playerNames.forEach((name, i) => {
    const color = allNotes.find(n => n.player_name === name)?.player_color || 'inherit';
    tabLabels += `<label class="nb-tab" for="${playerTabIds[i]}"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle;position:relative;top:-1px;"></span>${escapeHtml(name)}</label>`;
  });

  const allPanel = `<div data-gm-panel="0">${renderGMNotesFeed(allNotes)}</div>`;
  let playerPanels = '';
  playerNames.forEach((name, i) => {
    const playerNotes = allNotes.filter(n => n.player_name === name);
    playerPanels += `<div data-gm-panel="${i + 1}">${renderGMNotesFeed(playerNotes)}</div>`;
  });

  let activeCSS = `#${allTabId}:checked ~ .nb-tabs label[for="${allTabId}"] { background: linear-gradient(180deg,#efd898 0%,#d4ae58 100%); color:#2a1200; z-index:3; }
#${allTabId}:checked ~ .nb-paper [data-gm-panel="0"] { display:block; }`;
  playerNames.forEach((_, i) => {
    const tid = playerTabIds[i];
    activeCSS += `
#${tid}:checked ~ .nb-tabs label[for="${tid}"] { background: linear-gradient(180deg,#efd898 0%,#d4ae58 100%); color:#2a1200; z-index:3; }
#${tid}:checked ~ .nb-paper [data-gm-panel="${i + 1}"] { display:block; }`;
  });

  return `<div class="gm-nb-wrap">
    <style>.gm-nb-wrap [data-gm-panel]{display:none;} ${activeCSS}</style>
    ${radios}
    <div class="nb-tabs" style="flex-wrap:wrap;">${tabLabels}</div>
    <div class="nb-paper">
      <div class="nb-ruled"></div>
      ${allPanel}${playerPanels}
    </div>
  </div>`;
}

function renderGMNotebook() {
  const modal = document.getElementById('modal-gm-notebook');
  if (modal && modal.style.display !== 'none') renderGMNotebookModal();
}

async function revealClue(id) {
  await sb.from('clues').update({ revealed: true }).eq('id', id);
  await loadGMClues();
  toast('Clue revealed to players!');
}

async function unrevealClue(id) {
  await sb.from('clues').update({ revealed: false }).eq('id', id);
  await loadGMClues();
  toast('Clue hidden from players.');
}

// ── ADD CLUE ──
let currentClueType = 'image';

function showAddClue() {
  currentClueType = 'image';
  document.getElementById('clue-image-field').style.display = 'block';
  document.getElementById('clue-text-field').style.display = 'none';
  document.getElementById('type-btn-image').className = 'btn btn-primary btn-sm';
  document.getElementById('type-btn-text').className = 'btn btn-secondary btn-sm';
  openModal('modal-add-clue');
}

function setClueType(type) {
  currentClueType = type;
  document.getElementById('clue-image-field').style.display = type === 'image' ? 'block' : 'none';
  document.getElementById('clue-text-field').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('type-btn-image').className = type === 'image' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  document.getElementById('type-btn-text').className = type === 'text' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
}

function previewFile(input) {
  const label = document.getElementById('file-drop-label');
  if (input.files[0]) label.textContent = '📄 ' + input.files[0].name;
}

async function uploadClue() {
  const location_name = document.getElementById('clue-location').value.trim();
  const errEl = document.getElementById('add-clue-error');
  const btn = document.getElementById('add-clue-btn');
  if (!location_name) { errEl.textContent = 'Enter a location name.'; return; }

  const position = allClues.length + 1;

  if (currentClueType === 'text') {
    const clue_text = document.getElementById('clue-text-input').value.trim();
    if (!clue_text) { errEl.textContent = 'Enter the clue text.'; return; }
    btn.innerHTML = '<span class="spinner"></span> Saving…';
    btn.disabled = true;
    const { error } = await sb.from('clues').insert({ case_id: currentCaseId, location_name, clue_text, image_url: '', position });
    if (error) { errEl.textContent = error.message; btn.textContent = 'Add to Case File'; btn.disabled = false; return; }
  } else {
    const file = document.getElementById('clue-file').files[0];
    if (!file) { errEl.textContent = 'Select an image.'; return; }
    btn.innerHTML = '<span class="spinner"></span> Uploading…';
    btn.disabled = true;
    const ext = file.name.split('.').pop();
    const path = `${currentCaseId}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('clues').upload(path, file);
    if (upErr) { errEl.textContent = upErr.message; btn.textContent = 'Add to Case File'; btn.disabled = false; return; }
    const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
    const { error: dbErr } = await sb.from('clues').insert({ case_id: currentCaseId, location_name, image_url: urlData.publicUrl, clue_text: '', position });
    if (dbErr) { errEl.textContent = dbErr.message; btn.textContent = 'Add to Case File'; btn.disabled = false; return; }
  }

  btn.textContent = 'Add to Case File'; btn.disabled = false;
  document.getElementById('clue-location').value = '';
  document.getElementById('clue-file').value = '';
  document.getElementById('clue-text-input').value = '';
  document.getElementById('file-drop-label').textContent = 'Click to select image';
  errEl.textContent = '';
  closeModal('modal-add-clue');
  await loadGMClues();
  toast('Clue added!');
}

// ── PLAYER ──
function showPlayerJoin() {
  openModal('modal-player-join');
}

async function doPlayerJoin() {
  let code = document.getElementById('player-case-code').value.trim();
  const name = document.getElementById('player-name-input').value.trim();
  const errEl = document.getElementById('player-join-error');
  if (!code) { errEl.textContent = 'Enter a case code.'; return; }
  if (!name) { errEl.textContent = 'Enter your name.'; return; }
  playerName = name;
  playerColor = nameToColor(name);
  
  // Accept short 8-char prefix code — resolve to full UUID
  if (/^[0-9A-Fa-f]{8}$/.test(code)) {
    const prefix = code.toLowerCase();
    const { data: cases } = await sb.from('cases').select('id');
    const match = (cases || []).find(c => c.id.startsWith(prefix));
    if (!match) { errEl.textContent = 'Case not found. Check the code and try again.'; return; }
    code = match.id;
  }
  await enterPlayer(code);
}

let kickSubscription = null;

async function enterPlayer(caseId) {
  const [{ data: caseData, error }, { data: existing }] = await Promise.all([
    sb.from('cases').select('*').eq('id', caseId).single(),
    sb.from('players').select('is_kicked').eq('case_id', caseId).eq('player_name', playerName).single()
  ]);
  if (error || !caseData) {
    
    document.getElementById('player-join-error') && (document.getElementById('player-join-error').textContent = 'Case not found.');
    return;
  }

  if (existing?.is_kicked) {
    
    const errEl = document.getElementById('player-join-error') || document.getElementById('identity-error');
    if (errEl) errEl.textContent = 'You have been removed from this case by the Game Master.';
    return;
  }

  
  // Register player
  await sb.from('players').upsert(
    { case_id: caseId, player_name: playerName, player_color: playerColor, is_kicked: false },
    { onConflict: 'case_id,player_name' }
  );

  currentCaseId = caseId;
  currentCaseName = caseData.name;
  setMastheadCase(currentCaseName);
  currentCaseDescription = caseData.description || '';
  currentMapId = caseData.map_id || null;
  currentMapUrl = '';
  if (currentMapId) {
    const { data: mapData } = await sb.from('maps').select('url').eq('id', currentMapId).single();
    currentMapUrl = mapData?.url || '';
  }
  document.getElementById('mode-indicator').innerHTML = '<span class="mode-badge player">Investigator</span>';
  showMastheadLogout();
  document.getElementById('player-case-title').textContent = caseData.name;
  renderPlayerBriefing();
  renderPlayerMap();
  
  closeModal('modal-player-join');
  showScreen('player-screen');
  document.getElementById('player-notebook-section').style.display = '';
  await loadDirectoryFromServer(caseId);
  await loadPlayerClues();
  await loadNotes();
  renderPrivateNotes();
  subscribePlayer();
  subscribeNotes();
  subscribeKick(caseId);
  trackPlayerPresence(caseId);
}

function trackPlayerPresence(caseId) {
  if (playerPresenceChannel) sb.removeChannel(playerPresenceChannel);
  playerPresenceChannel = sb.channel('presence-' + caseId);
  playerPresenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await playerPresenceChannel.track({ player_name: playerName, player_color: playerColor });
    }
  });
}

function subscribeKick(caseId) {
  if (kickSubscription) sb.removeChannel(kickSubscription);
  kickSubscription = sb.channel('kick-' + caseId)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `case_id=eq.${caseId}` },
      payload => {
        if (payload.new.player_name === playerName && payload.new.is_kicked) showKickedScreen();
      })
    .subscribe();
}

function showKickedScreen() {
  if (playerSubscription) sb.removeChannel(playerSubscription);
  if (notesSubscription) sb.removeChannel(notesSubscription);
  if (kickSubscription) sb.removeChannel(kickSubscription);
  if (playerPresenceChannel) sb.removeChannel(playerPresenceChannel);
  const el = document.getElementById('kicked-overlay');
  el.style.display = 'flex';
}

async function loadPlayerClues() {
  const { data } = await sb.from('clues').select('*').eq('case_id', currentCaseId).eq('revealed', true).order('position');
  renderPlayerClues(data || []);
}

function renderPlayerClues(clues) {
  const meta = document.getElementById('player-meta');
  meta.textContent = clues.length ? `${clues.length} clue${clues.length !== 1 ? 's' : ''} gathered thus far` : '';

  if (!clues.length) {
    document.getElementById('player-content').innerHTML = '<div class="empty-state" style="color:var(--fog)">Awaiting the Game Master to reveal clues…</div>';
    return;
  }
  let html = '<div class="revealed-grid">';
  clues.forEach(c => {
    const body = c.clue_text
      ? `<div class="revealed-card-text">${c.clue_text}</div>`
      : `<img src="${c.image_url}" alt="${c.location_name}">`;
    html += `<div class="revealed-card" onclick="openClueExpand(${JSON.stringify(c).replace(/"/g, '&quot;')})">
      ${body}
      <div class="revealed-card-label">${c.location_name} <span style="float:right;opacity:0.4;font-size:0.8em">⤢</span></div>
    </div>`;
  });
  html += '</div>';
  document.getElementById('player-content').innerHTML = html;
}

function renderPlayerBriefing() {
  const desc = currentCaseDescription;
  const el = document.getElementById('player-briefing');
  if (!desc) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `<div class="case-briefing-panel">
    <div class="briefing-header" onclick="toggleBriefing('player-briefing-body')">
      <span>Case Briefing</span><span id="player-briefing-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="player-briefing-body" class="briefing-body">
      <p class="briefing-text">${escapeHtml(desc)}</p>
    </div>
  </div>`;
}

function subscribePlayer() {
  if (playerSubscription) sb.removeChannel(playerSubscription);
  playerSubscription = sb.channel('clues-' + currentCaseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clues', filter: `case_id=eq.${currentCaseId}` },
      () => loadPlayerClues())
    .subscribe();
}

// ── GM CLUE PREVIEW ──
function openGMCluePreview(clue) {
  openClueExpand(clue);
}

// ── LIGHTBOX ──
function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

// ── CLUE EXPAND (PLAYER) ──
function openClueExpand(clue) {
  document.getElementById('clue-expand-title').textContent = clue.location_name;
  const body = document.getElementById('clue-expand-body');
  if (clue.clue_text) {
    body.innerHTML = `<div style="padding:24px 28px;font-family:Georgia,'Palatino Linotype',Palatino,serif;font-size:1.1rem;line-height:1.9;color:var(--ink);background:var(--paper);background-image:repeating-linear-gradient(transparent,transparent 30px,rgba(139,105,20,0.12) 30px,rgba(139,105,20,0.12) 31px);min-height:200px;">${clue.clue_text}</div>`;
  } else {
    body.innerHTML = `<img src="${clue.image_url}" style="width:100%;display:block;max-height:70vh;object-fit:contain;background:#1a1208;" alt="${clue.location_name}">`;
  }
  openModal('modal-clue-expand');
}

// ── EDIT CLUE ──
function showEditClue(id) {
  const c = allClues.find(x => x.id === id);
  if (!c) return;
  document.getElementById('edit-clue-id').value = c.id;
  document.getElementById('edit-clue-location').value = c.location_name;
  const isText = !!c.clue_text;
  document.getElementById('edit-clue-type').value = isText ? 'text' : 'image';
  document.getElementById('edit-image-field').style.display = isText ? 'none' : 'block';
  document.getElementById('edit-text-field').style.display = isText ? 'block' : 'none';
  if (isText) document.getElementById('edit-clue-text').value = c.clue_text;
  document.getElementById('edit-file-drop-label').textContent = 'Click to replace image (leave empty to keep current)';
  document.getElementById('edit-clue-file').value = '';
  document.getElementById('edit-clue-error').textContent = '';
  openModal('modal-edit-clue');
}

function previewEditFile(input) {
  if (input.files[0]) document.getElementById('edit-file-drop-label').textContent = '📄 ' + input.files[0].name;
}

async function saveEditClue() {
  const id = document.getElementById('edit-clue-id').value;
  const location_name = document.getElementById('edit-clue-location').value.trim();
  const type = document.getElementById('edit-clue-type').value;
  const btn = document.getElementById('edit-clue-btn');
  const errEl = document.getElementById('edit-clue-error');
  if (!location_name) { errEl.textContent = 'Enter a location name.'; return; }

  btn.innerHTML = '<span class="spinner"></span> Saving…';
  btn.disabled = true;

  let updates = { location_name };

  if (type === 'text') {
    const clue_text = document.getElementById('edit-clue-text').value.trim();
    if (!clue_text) { errEl.textContent = 'Enter clue text.'; btn.textContent = 'Save Changes'; btn.disabled = false; return; }
    updates.clue_text = clue_text;
  } else {
    const file = document.getElementById('edit-clue-file').files[0];
    if (file) {
      const ext = file.name.split('.').pop();
      const path = `${currentCaseId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('clues').upload(path, file);
      if (upErr) { errEl.textContent = upErr.message; btn.textContent = 'Save Changes'; btn.disabled = false; return; }
      const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
      updates.image_url = urlData.publicUrl;
    }
  }

  const { error } = await sb.from('clues').update(updates).eq('id', id);
  btn.textContent = 'Save Changes'; btn.disabled = false;
  if (error) { errEl.textContent = error.message; return; }
  closeModal('modal-edit-clue');
  await loadGMClues();
  toast('Clue updated!');
}

// ── DELETE CASE ──
async function deleteCase() {
  if (!currentCaseId) return;
  if (!confirm(`Delete case "${currentCaseName}" and all its clues? This cannot be undone.`)) return;
  await sb.from('clues').delete().eq('case_id', currentCaseId);
  await sb.from('cases').delete().eq('id', currentCaseId);
  currentCaseId = null;
  currentCaseName = null;
  setMastheadCase("");
  document.getElementById('delete-case-btn').style.display = 'none';
  document.getElementById('share-box').style.display = 'none';
  const ib = document.getElementById('gm-invite-block'); if (ib) ib.style.display = 'none';
  const id2 = document.getElementById('gm-invite-divider'); if (id2) id2.style.display = 'none';
  document.getElementById('gm-content').innerHTML = '<div class="empty-state">Select or create a case to begin.</div>';
  const rp = document.getElementById('gm-right-panel');
  if (rp) rp.style.display = 'none';
  await loadCases();
  toast('Case deleted.');
}

// ── DELETE CLUE ──
async function deleteClue(id) {
  if (!confirm('Delete this clue? This cannot be undone.')) return;
  await sb.from('clues').delete().eq('id', id);
  await loadGMClues();
  toast('Clue deleted.');
}

// ── PLAYER IDENTITY ──
const PLAYER_COLORS = [
  { label: 'Crimson',  value: '#e05555' },
  { label: 'Navy',     value: '#5588dd' },
  { label: 'Forest',   value: '#55bb55' },
  { label: 'Plum',     value: '#cc66cc' },
  { label: 'Teal',     value: '#44cccc' },
  { label: 'Amber',    value: '#e8a030' },
  { label: 'Sky',      value: '#55aaee' },
  { label: 'Coral',    value: '#ee7755' },
];

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length].value;
}

let playerName = '';
let playerColor = PLAYER_COLORS[0].value;
let pendingCaseId = null;

// ── NOTES ──
let notesSubscription = null;
let currentNotes = [];

// ── PRIVATE NOTES (localStorage) ──
function privateNotesKey() {
  return `private_notes_${playerName}_${currentCaseId}`;
}

function loadPrivateNotes() {
  try {
    return JSON.parse(localStorage.getItem(privateNotesKey()) || '[]');
  } catch { return []; }
}

function savePrivateNotes(notes) {
  try { localStorage.setItem(privateNotesKey(), JSON.stringify(notes)); } catch {}
}

function renderPrivateNotes() {
  const container = document.getElementById('nb-private-notes');
  if (!container) return;
  const notes = loadPrivateNotes();
  if (!notes.length) {
    container.innerHTML = `<div style="font-family:'Courier Prime','Courier New',monospace;font-size:0.78rem;color:rgba(60,35,5,0.45);font-style:italic;padding:6px 0;">No private notes yet.</div>`;
    return;
  }
  container.innerHTML = notes.map(n => {
    const time = new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="nb-note" data-private-id="${escapeHtml(n.id)}">
      <div class="nb-note-meta">
        <span class="nb-note-name" style="color:#5a3a10;">Private</span>
        <span class="nb-note-time">${time}</span>
        <span class="nb-note-actions">
          <button class="nb-note-action" title="Edit" onclick="editPrivateNote('${escapeHtml(n.id)}')">✎ Edit</button>
          <button class="nb-note-action" title="Share with team" onclick="sharePrivateNote('${escapeHtml(n.id)}')">↗ Share</button>
          <button class="nb-note-action danger" title="Delete" onclick="deletePrivateNote('${escapeHtml(n.id)}')">✕</button>
        </span>
      </div>
      <div class="nb-note-text" id="nb-priv-text-${escapeHtml(n.id)}">${escapeHtml(n.text)}</div>
    </div>`;
  }).join('');
}

function addPrivateNote() {
  const input = document.getElementById('nb-private-input');
  const text = input.value.trim();
  if (!text) return;
  const notes = loadPrivateNotes();
  notes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), text, timestamp: Date.now() });
  savePrivateNotes(notes);
  input.value = '';
  renderPrivateNotes();
}

function deletePrivateNote(id) {
  showConfirmDelete("Delete this private note?", () => {
    const notes = loadPrivateNotes().filter(n => n.id !== id);
    savePrivateNotes(notes);
    renderPrivateNotes();
  });
}

function editPrivateNote(id) {
  const notes = loadPrivateNotes();
  const note = notes.find(n => n.id === id);
  if (!note) return;
  const textEl = document.getElementById(`nb-priv-text-${id}`);
  if (!textEl) return;
  const noteEl = textEl.closest('.nb-note');
  textEl.style.display = 'none';
  const editArea = document.createElement('textarea');
  editArea.className = 'nb-note-edit-input';
  editArea.value = note.text;
  const row = document.createElement('div');
  row.className = 'nb-note-edit-row';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'nb-note-edit-save';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'nb-note-edit-cancel';
  cancelBtn.textContent = 'Cancel';
  row.appendChild(saveBtn);
  row.appendChild(cancelBtn);
  noteEl.appendChild(editArea);
  noteEl.appendChild(row);
  editArea.focus();
  saveBtn.onclick = () => {
    const newText = editArea.value.trim();
    if (!newText) return;
    const all = loadPrivateNotes();
    const idx = all.findIndex(n => n.id === id);
    if (idx !== -1) { all[idx].text = newText; savePrivateNotes(all); }
    renderPrivateNotes();
  };
  cancelBtn.onclick = () => renderPrivateNotes();
}

async function sharePrivateNote(id) {
  const notes = loadPrivateNotes();
  const note = notes.find(n => n.id === id);
  if (!note) return;
  const { error } = await sb.from('notes').insert({
    case_id: currentCaseId,
    player_name: playerName,
    player_color: playerColor,
    content: note.text,
  });
  if (error) { toast('Error sharing note.'); return; }
  toast('Note shared with the team.');
  await loadNotes();
}

// ── SHARED NOTES (Supabase) ──
async function loadNotes() {
  const { data } = await sb.from('notes').select('*').eq('case_id', currentCaseId).order('created_at');
  currentNotes = data || [];
  renderSharedNotes(currentNotes);
}

// Keep addNote as alias for addSharedNote (called from subscriptions, etc.)
async function addNote() { return addSharedNote(); }

async function addSharedNote() {
  const input = document.getElementById('nb-shared-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  const { error } = await sb.from('notes').insert({
    case_id: currentCaseId,
    player_name: playerName,
    player_color: playerColor,
    content,
  });
  if (error) { toast('Error saving note.'); return; }
  input.value = '';
  await loadNotes();
}

function renderSharedNotes(notes) {
  const container = document.getElementById('nb-shared-notes');
  if (!container) return;
  if (!notes.length) {
    container.innerHTML = `<div style="font-family:'Courier Prime','Courier New',monospace;font-size:0.78rem;color:rgba(60,35,5,0.45);font-style:italic;padding:6px 0;">No team notes yet. Be the first to record a deduction.</div>`;
    return;
  }
  container.innerHTML = notes.map(n => {
    const time = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isOwn = n.player_name === playerName && n.player_color === playerColor;
    const ownActions = isOwn ? `
      <button class="nb-note-action" title="Edit" onclick="editSharedNote('${n.id}')">✎ Edit</button>
      <button class="nb-note-action danger" title="Delete" onclick="deleteSharedNote('${n.id}')">✕</button>` : '';
    return `<div class="nb-note" data-shared-id="${n.id}">
      <div class="nb-note-meta">
        <span class="nb-note-name" style="color:${n.player_color};">${escapeHtml(n.player_name)}</span>
        <span class="nb-note-time">${time}</span>
        ${isOwn ? `<span class="nb-note-actions">${ownActions}</span>` : ''}
      </div>
      <div class="nb-note-text" id="nb-shared-text-${n.id}" style="color:#0e0600;">${escapeHtml(n.content)}</div>
    </div>`;
  }).join('');
}

async function deleteSharedNote(id) {
  showConfirmDelete("Delete this note from the team notebook?", async () => {
    const { error } = await sb.from('notes').delete().eq('id', id);
    if (error) { toast('Error deleting note.'); return; }
    await loadNotes();
  });
}

// Keep deleteNote as alias for backward compat
async function deleteNote(id) { return deleteSharedNote(id); }

async function editSharedNote(id) {
  const note = currentNotes.find(n => n.id === id);
  if (!note) return;
  const textEl = document.getElementById(`nb-shared-text-${id}`);
  if (!textEl) return;
  const noteEl = textEl.closest('.nb-note');
  textEl.style.display = 'none';
  const editArea = document.createElement('textarea');
  editArea.className = 'nb-note-edit-input';
  editArea.value = note.content;
  const row = document.createElement('div');
  row.className = 'nb-note-edit-row';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'nb-note-edit-save';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'nb-note-edit-cancel';
  cancelBtn.textContent = 'Cancel';
  row.appendChild(saveBtn);
  row.appendChild(cancelBtn);
  noteEl.appendChild(editArea);
  noteEl.appendChild(row);
  editArea.focus();
  saveBtn.onclick = async () => {
    const newContent = editArea.value.trim();
    if (!newContent) return;
    const { error } = await sb.from('notes').update({ content: newContent }).eq('id', id);
    if (error) { toast('Error saving.'); return; }
    await loadNotes();
  };
  cancelBtn.onclick = () => renderSharedNotes(currentNotes);
}

function showConfirmDelete(message, onConfirm) {
  document.getElementById('confirm-delete-msg').textContent = message;
  const btn = document.getElementById('confirm-delete-ok');
  btn.onclick = () => { closeConfirmDelete(); onConfirm(); };
  const modal = document.getElementById('modal-confirm-delete');
  modal.style.display = 'flex';
}
function closeConfirmDelete() {
  document.getElementById('modal-confirm-delete').style.display = 'none';
}

function subscribeNotes() {
  if (notesSubscription) sb.removeChannel(notesSubscription);
  notesSubscription = sb.channel('notes-' + currentCaseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `case_id=eq.${currentCaseId}` },
      () => loadNotes())
    .subscribe();
}

// ── IDENTITY MODAL (URL join) ──
let _identityResolveFn = null;

function promptIdentity() {
  return new Promise(resolve => {
    _identityResolveFn = resolve;
    document.getElementById('identity-name-input').value = playerName;
    document.getElementById('identity-error').textContent = '';
    openModal('modal-player-identity');
  });
}

function confirmIdentity() {
  const name = document.getElementById('identity-name-input').value.trim();
  if (!name) { document.getElementById('identity-error').textContent = 'Enter your name.'; return; }
  playerName = name;
  playerColor = nameToColor(name);
  closeModal('modal-player-identity');
  if (_identityResolveFn) { _identityResolveFn(); _identityResolveFn = null; }
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  // Check for player link
  const params = new URLSearchParams(location.search);
  const caseParam = params.get('case');
  if (caseParam) {
    await promptIdentity();
    await enterPlayer(caseParam);
    return;
  }
  // Check for GM session
  if (store.get(GM_SESSION_KEY)) {
    enterGM();
    return;
  }
  showScreen('landing');
});
