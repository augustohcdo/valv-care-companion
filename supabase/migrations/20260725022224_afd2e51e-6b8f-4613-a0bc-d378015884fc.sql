
-- 1. Expand prosthesis_catalog schema with clinical + reference metadata
ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS reference_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS annulus_min_mm NUMERIC,
  ADD COLUMN IF NOT EXISTS annulus_max_mm NUMERIC;

-- 2. Bulk insert expanded catalog. Sources cited via reference_url.
-- Reset existing seeded rows (only the 12 minimal ones) to keep model clean.
DELETE FROM public.prosthesis_catalog
  WHERE (manufacturer, model_name) IN (
    ('Edwards','Magna Ease'), ('Edwards','Inspiris Resilia'),
    ('Medtronic','Avalus'), ('Abbott','Epic')
  ) AND description IS NULL;

-- EDWARDS ==========================================================
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, display_order) VALUES
-- Magna Ease Aortic
('Edwards','Magna Ease','biologica_aortica',19,'Bioprótese pericárdica bovina aórtica com stent, tecido tratado ThermaFix. Faixa 19–29 mm.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/carpentier-edwards-perimount-magna-ease',10),
('Edwards','Magna Ease','biologica_aortica',21,'Bioprótese pericárdica bovina aórtica com stent, tecido tratado ThermaFix.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/carpentier-edwards-perimount-magna-ease',10),
('Edwards','Magna Ease','biologica_aortica',23,'Bioprótese pericárdica bovina aórtica com stent, tecido tratado ThermaFix.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/carpentier-edwards-perimount-magna-ease',10),
('Edwards','Magna Ease','biologica_aortica',25,'Bioprótese pericárdica bovina aórtica com stent, tecido tratado ThermaFix.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/carpentier-edwards-perimount-magna-ease',10),
('Edwards','Magna Ease','biologica_aortica',27,'Bioprótese pericárdica bovina aórtica com stent, tecido tratado ThermaFix.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/carpentier-edwards-perimount-magna-ease',10),
('Edwards','Magna Ease','biologica_aortica',29,'Bioprótese pericárdica bovina aórtica com stent, tecido tratado ThermaFix.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/carpentier-edwards-perimount-magna-ease',10),
-- Inspiris Resilia Aortic
('Edwards','Inspiris Resilia','biologica_aortica',19,'Bioprótese aórtica pericárdica bovina com tecido RESILIA (integridade em armazenagem seca) e VFit expansível para valve-in-valve futuro.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/inspiris-resilia',11),
('Edwards','Inspiris Resilia','biologica_aortica',21,'Bioprótese aórtica pericárdica bovina com tecido RESILIA e VFit expansível.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/inspiris-resilia',11),
('Edwards','Inspiris Resilia','biologica_aortica',23,'Bioprótese aórtica pericárdica bovina com tecido RESILIA e VFit expansível.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/inspiris-resilia',11),
('Edwards','Inspiris Resilia','biologica_aortica',25,'Bioprótese aórtica pericárdica bovina com tecido RESILIA e VFit expansível.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/inspiris-resilia',11),
('Edwards','Inspiris Resilia','biologica_aortica',27,'Bioprótese aórtica pericárdica bovina com tecido RESILIA e VFit expansível.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/inspiris-resilia',11),
-- Perimount Magna (classical)
('Edwards','Perimount','biologica_aortica',19,'Bioprótese pericárdica bovina aórtica clássica Carpentier-Edwards Perimount.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical',12),
('Edwards','Perimount','biologica_aortica',21,'Bioprótese pericárdica bovina aórtica clássica Carpentier-Edwards Perimount.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical',12),
('Edwards','Perimount','biologica_aortica',23,'Bioprótese pericárdica bovina aórtica clássica Carpentier-Edwards Perimount.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical',12),
('Edwards','Perimount','biologica_aortica',25,'Bioprótese pericárdica bovina aórtica clássica Carpentier-Edwards Perimount.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical',12),
('Edwards','Perimount','biologica_aortica',27,'Bioprótese pericárdica bovina aórtica clássica Carpentier-Edwards Perimount.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical',12),
-- Intuity Elite (rapid deployment)
('Edwards','Intuity Elite','biologica_aortica',19,'Bioprótese aórtica de implante rápido (rapid deployment) com frame balão-expansível subanular; reduz tempo de CEC.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/intuity-elite',13),
('Edwards','Intuity Elite','biologica_aortica',21,'Bioprótese aórtica de implante rápido com frame balão-expansível subanular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/intuity-elite',13),
('Edwards','Intuity Elite','biologica_aortica',23,'Bioprótese aórtica de implante rápido com frame balão-expansível subanular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/intuity-elite',13),
('Edwards','Intuity Elite','biologica_aortica',25,'Bioprótese aórtica de implante rápido com frame balão-expansível subanular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/intuity-elite',13),
('Edwards','Intuity Elite','biologica_aortica',27,'Bioprótese aórtica de implante rápido com frame balão-expansível subanular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/intuity-elite',13),
-- Konect Resilia (valved conduit)
('Edwards','Konect Resilia','biologica_aortica',21,'Conduto valvado aórtico pré-montado com bioprótese Inspiris Resilia + enxerto Vascutek Gelweave. Uso em Bentall.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/konect-resilia',14),
('Edwards','Konect Resilia','biologica_aortica',23,'Conduto valvado aórtico pré-montado com Inspiris Resilia + enxerto vascular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/konect-resilia',14),
('Edwards','Konect Resilia','biologica_aortica',25,'Conduto valvado aórtico pré-montado com Inspiris Resilia + enxerto vascular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/konect-resilia',14),
('Edwards','Konect Resilia','biologica_aortica',27,'Conduto valvado aórtico pré-montado com Inspiris Resilia + enxerto vascular.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/aortic-surgical/konect-resilia',14),
-- Magna Mitral Ease
('Edwards','Magna Mitral Ease','biologica_mitral',25,'Bioprótese pericárdica bovina mitral com stent, perfil baixo para redução de obstrução do TSVE.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',15),
('Edwards','Magna Mitral Ease','biologica_mitral',27,'Bioprótese pericárdica bovina mitral com stent.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',15),
('Edwards','Magna Mitral Ease','biologica_mitral',29,'Bioprótese pericárdica bovina mitral com stent.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',15),
('Edwards','Magna Mitral Ease','biologica_mitral',31,'Bioprótese pericárdica bovina mitral com stent.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',15),
('Edwards','Magna Mitral Ease','biologica_mitral',33,'Bioprótese pericárdica bovina mitral com stent.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',15),
-- Mitris Resilia
('Edwards','Mitris Resilia','biologica_mitral',25,'Bioprótese mitral pericárdica bovina com tecido RESILIA (armazenagem seca).','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/mitris-resilia',16),
('Edwards','Mitris Resilia','biologica_mitral',27,'Bioprótese mitral pericárdica bovina com tecido RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/mitris-resilia',16),
('Edwards','Mitris Resilia','biologica_mitral',29,'Bioprótese mitral pericárdica bovina com tecido RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/mitris-resilia',16),
('Edwards','Mitris Resilia','biologica_mitral',31,'Bioprótese mitral pericárdica bovina com tecido RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/mitris-resilia',16),
('Edwards','Mitris Resilia','biologica_mitral',33,'Bioprótese mitral pericárdica bovina com tecido RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/mitris-resilia',16);

-- Edwards TAVI (Sapien) with annular ranges per IFU
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Edwards','Sapien 3','tavi',20,'Válvula transcateter balão-expansível de terceira geração, saia externa para redução de leak paravalvar.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3',18,20,17),
('Edwards','Sapien 3','tavi',23,'Válvula transcateter balão-expansível Sapien 3.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3',20,23,17),
('Edwards','Sapien 3','tavi',26,'Válvula transcateter balão-expansível Sapien 3.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3',23,26,17),
('Edwards','Sapien 3','tavi',29,'Válvula transcateter balão-expansível Sapien 3.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3',26,29,17),
('Edwards','Sapien 3 Ultra','tavi',20,'Sapien 3 Ultra: saia externa mais alta (40%) para melhor selagem paravalvar.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra',18,20,17),
('Edwards','Sapien 3 Ultra','tavi',23,'Sapien 3 Ultra: saia externa mais alta.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra',20,23,17),
('Edwards','Sapien 3 Ultra','tavi',26,'Sapien 3 Ultra: saia externa mais alta.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra',23,26,17),
('Edwards','Sapien 3 Ultra RESILIA','tavi',20,'Sapien 3 Ultra com tecido RESILIA para durabilidade estendida.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra-resilia',18,20,17),
('Edwards','Sapien 3 Ultra RESILIA','tavi',23,'Sapien 3 Ultra RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra-resilia',20,23,17),
('Edwards','Sapien 3 Ultra RESILIA','tavi',26,'Sapien 3 Ultra RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra-resilia',23,26,17),
('Edwards','Sapien 3 Ultra RESILIA','tavi',29,'Sapien 3 Ultra RESILIA.','https://www.edwards.com/healthcare-professionals/products-services/transcatheter/aortic/sapien-3-ultra-resilia',26,29,17);

-- Edwards Rings (annular diameter = ring size in mm)
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Edwards','Physio II (5200)','anel_anuloplastia',24,'Anel de anuloplastia mitral semi-rígido remodelador Carpentier-Edwards Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',23,25,19),
('Edwards','Physio II (5200)','anel_anuloplastia',26,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',25,27,19),
('Edwards','Physio II (5200)','anel_anuloplastia',28,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',27,29,19),
('Edwards','Physio II (5200)','anel_anuloplastia',30,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',29,31,19),
('Edwards','Physio II (5200)','anel_anuloplastia',32,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',31,33,19),
('Edwards','Physio II (5200)','anel_anuloplastia',34,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',33,35,19),
('Edwards','Physio II (5200)','anel_anuloplastia',36,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',35,37,19),
('Edwards','Physio II (5200)','anel_anuloplastia',40,'Anel mitral Physio II.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical/carpentier-edwards-physio-ii',38,42,19),
('Edwards','Physio Flex (5300)','anel_anuloplastia',26,'Anel mitral semi-rígido Physio Flex, com maior flexibilidade em segmentos posteriores.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',25,27,20),
('Edwards','Physio Flex (5300)','anel_anuloplastia',28,'Anel mitral Physio Flex.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',27,29,20),
('Edwards','Physio Flex (5300)','anel_anuloplastia',30,'Anel mitral Physio Flex.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',29,31,20),
('Edwards','Physio Flex (5300)','anel_anuloplastia',32,'Anel mitral Physio Flex.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',31,33,20),
('Edwards','Physio Flex (5300)','anel_anuloplastia',34,'Anel mitral Physio Flex.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',33,35,20),
('Edwards','Physio Flex (5300)','anel_anuloplastia',36,'Anel mitral Physio Flex.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',35,37,20),
('Edwards','Cosgrove-Edwards Band (4600)','anel_anuloplastia',26,'Banda posterior mitral flexível Cosgrove-Edwards.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',25,27,21),
('Edwards','Cosgrove-Edwards Band (4600)','anel_anuloplastia',28,'Banda posterior mitral flexível Cosgrove-Edwards.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',27,29,21),
('Edwards','Cosgrove-Edwards Band (4600)','anel_anuloplastia',30,'Banda posterior mitral flexível Cosgrove-Edwards.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',29,31,21),
('Edwards','Cosgrove-Edwards Band (4600)','anel_anuloplastia',32,'Banda posterior mitral flexível Cosgrove-Edwards.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',31,33,21),
('Edwards','Cosgrove-Edwards Band (4600)','anel_anuloplastia',34,'Banda posterior mitral flexível Cosgrove-Edwards.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',33,35,21),
('Edwards','Cosgrove-Edwards Band (4600)','anel_anuloplastia',36,'Banda posterior mitral flexível Cosgrove-Edwards.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/mitral-surgical',35,37,21),
('Edwards','MC3 Tricuspid (4900)','anel_anuloplastia',26,'Anel tricúspide tridimensional Edwards MC3.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/tricuspid-surgical',25,27,22),
('Edwards','MC3 Tricuspid (4900)','anel_anuloplastia',28,'Anel tricúspide MC3.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/tricuspid-surgical',27,29,22),
('Edwards','MC3 Tricuspid (4900)','anel_anuloplastia',30,'Anel tricúspide MC3.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/tricuspid-surgical',29,31,22),
('Edwards','MC3 Tricuspid (4900)','anel_anuloplastia',32,'Anel tricúspide MC3.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/tricuspid-surgical',31,33,22),
('Edwards','MC3 Tricuspid (4900)','anel_anuloplastia',34,'Anel tricúspide MC3.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/tricuspid-surgical',33,35,22),
('Edwards','MC3 Tricuspid (4900)','anel_anuloplastia',36,'Anel tricúspide MC3.','https://www.edwards.com/healthcare-professionals/products-services/heart-valves/tricuspid-surgical',35,37,22);

-- MERIL ============================================================
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Meril','Myval','tavi',20,'Válvula transcateter balão-expansível Myval, com stent híbrido nickel-cobalto e folhetos pericárdicos bovinos.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',18,20,25),
('Meril','Myval','tavi',215,'Myval tamanho intermediário 21.5 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',20,22,25),
('Meril','Myval','tavi',23,'Myval 23 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',21,23,25),
('Meril','Myval','tavi',245,'Myval 24.5 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',22,24,25),
('Meril','Myval','tavi',26,'Myval 26 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',24,26,25),
('Meril','Myval','tavi',275,'Myval 27.5 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',26,28,25),
('Meril','Myval','tavi',29,'Myval 29 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-thv-series',27,29,25),
('Meril','Myval Octacor','tavi',20,'Myval Octacor: geração 2 com 8 células internas e saia externa reforçada.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',18,20,26),
('Meril','Myval Octacor','tavi',215,'Myval Octacor 21.5 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',20,22,26),
('Meril','Myval Octacor','tavi',23,'Myval Octacor 23 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',21,23,26),
('Meril','Myval Octacor','tavi',245,'Myval Octacor 24.5 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',22,24,26),
('Meril','Myval Octacor','tavi',26,'Myval Octacor 26 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',24,26,26),
('Meril','Myval Octacor','tavi',275,'Myval Octacor 27.5 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',26,28,26),
('Meril','Myval Octacor','tavi',29,'Myval Octacor 29 mm.','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',27,29,26),
('Meril','Myval Octacor','tavi',305,'Myval Octacor 30.5 mm (large annulus).','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',28,30,26),
('Meril','Myval Octacor','tavi',32,'Myval Octacor 32 mm (extra-large annulus).','https://www.merillife.com/medical-devices/structural-heart/myval-octacor',30,32,26);

INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, display_order) VALUES
('Meril','Dafodil','biologica_aortica',19,'Bioprótese aórtica pericárdica bovina cirúrgica Dafodil (tecido antimineralização).','https://www.merillife.com/medical-devices/structural-heart/dafodil',27),
('Meril','Dafodil','biologica_aortica',21,'Bioprótese aórtica Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',27),
('Meril','Dafodil','biologica_aortica',23,'Bioprótese aórtica Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',27),
('Meril','Dafodil','biologica_aortica',25,'Bioprótese aórtica Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',27),
('Meril','Dafodil','biologica_aortica',27,'Bioprótese aórtica Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',27),
('Meril','Dafodil','biologica_mitral',25,'Bioprótese mitral pericárdica bovina Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',28),
('Meril','Dafodil','biologica_mitral',27,'Bioprótese mitral Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',28),
('Meril','Dafodil','biologica_mitral',29,'Bioprótese mitral Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',28),
('Meril','Dafodil','biologica_mitral',31,'Bioprótese mitral Dafodil.','https://www.merillife.com/medical-devices/structural-heart/dafodil',28),
('Meril','Miltonia','mecanica',17,'Válvula mecânica bileaflet aórtica pirocarbono Miltonia.','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',19,'Válvula mecânica bileaflet aórtica Miltonia.','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',21,'Válvula mecânica bileaflet aórtica Miltonia.','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',23,'Válvula mecânica bileaflet aórtica Miltonia.','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',25,'Válvula mecânica bileaflet aórtica Miltonia.','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',27,'Válvula mecânica bileaflet Miltonia.','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',29,'Válvula mecânica bileaflet Miltonia (mitral).','https://www.merillife.com/medical-devices/structural-heart/miltonia',29),
('Meril','Miltonia','mecanica',31,'Válvula mecânica bileaflet Miltonia (mitral).','https://www.merillife.com/medical-devices/structural-heart/miltonia',29);

-- ABBOTT ===========================================================
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Abbott','Portico','tavi',23,'Válvula transcateter autoexpansível Portico, folhetos pericárdicos bovinos, recapturável e reposicionável.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/portico.html',19,21,30),
('Abbott','Portico','tavi',25,'Portico 25 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/portico.html',21,23,30),
('Abbott','Portico','tavi',27,'Portico 27 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/portico.html',23,25,30),
('Abbott','Portico','tavi',29,'Portico 29 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/portico.html',25,27,30),
('Abbott','Navitor','tavi',23,'Navitor: TAVI autoexpansível de segunda geração com NaviSeal (skirt ativa) para redução de leak paravalvar.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/navitor.html',19,21,31),
('Abbott','Navitor','tavi',25,'Navitor 25 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/navitor.html',21,23,31),
('Abbott','Navitor','tavi',27,'Navitor 27 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/navitor.html',23,25,31),
('Abbott','Navitor','tavi',29,'Navitor 29 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-aortic-valve-implantation/navitor.html',25,27,31);

INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, display_order) VALUES
('Abbott','Trifecta GT','biologica_aortica',19,'Bioprótese aórtica pericárdica bovina Trifecta GT (Glide Technology), montagem externa dos folhetos.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/trifecta.html',32),
('Abbott','Trifecta GT','biologica_aortica',21,'Trifecta GT 21 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/trifecta.html',32),
('Abbott','Trifecta GT','biologica_aortica',23,'Trifecta GT 23 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/trifecta.html',32),
('Abbott','Trifecta GT','biologica_aortica',25,'Trifecta GT 25 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/trifecta.html',32),
('Abbott','Trifecta GT','biologica_aortica',27,'Trifecta GT 27 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/trifecta.html',32),
('Abbott','Trifecta GT','biologica_aortica',29,'Trifecta GT 29 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/trifecta.html',32),
('Abbott','Epic','biologica_aortica',19,'Bioprótese aórtica porcina stented Epic com tecido Linx AC.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',33),
('Abbott','Epic','biologica_aortica',21,'Epic aórtica 21 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',33),
('Abbott','Epic','biologica_aortica',23,'Epic aórtica 23 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',33),
('Abbott','Epic','biologica_aortica',25,'Epic aórtica 25 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',33),
('Abbott','Epic','biologica_aortica',27,'Epic aórtica 27 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',33),
('Abbott','Epic','biologica_mitral',25,'Bioprótese mitral porcina Epic.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',34),
('Abbott','Epic','biologica_mitral',27,'Epic mitral 27 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',34),
('Abbott','Epic','biologica_mitral',29,'Epic mitral 29 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',34),
('Abbott','Epic','biologica_mitral',31,'Epic mitral 31 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/epic.html',34),
('Abbott','St. Jude Regent','mecanica',17,'Válvula mecânica bileaflet aórtica St. Jude Medical Regent (pirocarbono), perfil supra-anular.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-regent.html',35),
('Abbott','St. Jude Regent','mecanica',19,'SJM Regent 19 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-regent.html',35),
('Abbott','St. Jude Regent','mecanica',21,'SJM Regent 21 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-regent.html',35),
('Abbott','St. Jude Regent','mecanica',23,'SJM Regent 23 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-regent.html',35),
('Abbott','St. Jude Regent','mecanica',25,'SJM Regent 25 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-regent.html',35),
('Abbott','St. Jude Regent','mecanica',27,'SJM Regent 27 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-regent.html',35),
('Abbott','St. Jude Masters HP','mecanica',17,'Válvula mecânica bileaflet St. Jude Masters HP (Hemodynamic Plus).','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',19,'SJM Masters HP 19.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',21,'SJM Masters HP 21.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',23,'SJM Masters HP 23.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',25,'SJM Masters HP 25.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',27,'SJM Masters HP 27.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',29,'SJM Masters HP 29 (mitral).','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36),
('Abbott','St. Jude Masters HP','mecanica',31,'SJM Masters HP 31 (mitral).','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valves/sjm-masters.html',36);

-- Abbott rings
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Abbott','Rigid Saddle Ring','anel_anuloplastia',26,'Anel mitral rígido em formato de sela (SJM/Abbott Rigid Saddle).','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/repair.html',25,27,37),
('Abbott','Rigid Saddle Ring','anel_anuloplastia',28,'Anel mitral Rigid Saddle 28 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/repair.html',27,29,37),
('Abbott','Rigid Saddle Ring','anel_anuloplastia',30,'Anel mitral Rigid Saddle 30 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/repair.html',29,31,37),
('Abbott','Rigid Saddle Ring','anel_anuloplastia',32,'Anel mitral Rigid Saddle 32 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/repair.html',31,33,37),
('Abbott','Rigid Saddle Ring','anel_anuloplastia',34,'Anel mitral Rigid Saddle 34 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/repair.html',33,35,37),
('Abbott','Rigid Saddle Ring','anel_anuloplastia',36,'Anel mitral Rigid Saddle 36 mm.','https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/repair.html',35,37,37);

-- CORCYM ===========================================================
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Corcym','Perceval Plus','biologica_aortica',21,'Bioprótese aórtica sutureless Perceval Plus (autoexpansível, sem sutura), tamanho S.','https://www.corcym.com/en/products/perceval-plus',19,21,40),
('Corcym','Perceval Plus','biologica_aortica',23,'Perceval Plus M (23 mm).','https://www.corcym.com/en/products/perceval-plus',21,23,40),
('Corcym','Perceval Plus','biologica_aortica',25,'Perceval Plus L (25 mm).','https://www.corcym.com/en/products/perceval-plus',23,25,40),
('Corcym','Perceval Plus','biologica_aortica',27,'Perceval Plus XL (27 mm).','https://www.corcym.com/en/products/perceval-plus',25,27,40);

INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, display_order) VALUES
('Corcym','Crown PRT','biologica_aortica',19,'Bioprótese aórtica pericárdica bovina Crown PRT com tratamento anticalcificante.','https://www.corcym.com/en/products/crown-prt',41),
('Corcym','Crown PRT','biologica_aortica',21,'Crown PRT 21 mm.','https://www.corcym.com/en/products/crown-prt',41),
('Corcym','Crown PRT','biologica_aortica',23,'Crown PRT 23 mm.','https://www.corcym.com/en/products/crown-prt',41),
('Corcym','Crown PRT','biologica_aortica',25,'Crown PRT 25 mm.','https://www.corcym.com/en/products/crown-prt',41),
('Corcym','Crown PRT','biologica_aortica',27,'Crown PRT 27 mm.','https://www.corcym.com/en/products/crown-prt',41),
('Corcym','Crown PRT','biologica_aortica',29,'Crown PRT 29 mm.','https://www.corcym.com/en/products/crown-prt',41),
('Corcym','Solo Smart','biologica_aortica',19,'Bioprótese aórtica stentless pericárdica bovina Solo Smart.','https://www.corcym.com/en/products/solo-smart',42),
('Corcym','Solo Smart','biologica_aortica',21,'Solo Smart 21 mm.','https://www.corcym.com/en/products/solo-smart',42),
('Corcym','Solo Smart','biologica_aortica',23,'Solo Smart 23 mm.','https://www.corcym.com/en/products/solo-smart',42),
('Corcym','Solo Smart','biologica_aortica',25,'Solo Smart 25 mm.','https://www.corcym.com/en/products/solo-smart',42),
('Corcym','Solo Smart','biologica_aortica',27,'Solo Smart 27 mm.','https://www.corcym.com/en/products/solo-smart',42);

INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Corcym','Memo 3D','anel_anuloplastia',24,'Anel mitral semi-rígido tridimensional Memo 3D.','https://www.corcym.com/en/products/memo-3d',23,25,43),
('Corcym','Memo 3D','anel_anuloplastia',26,'Memo 3D 26 mm.','https://www.corcym.com/en/products/memo-3d',25,27,43),
('Corcym','Memo 3D','anel_anuloplastia',28,'Memo 3D 28 mm.','https://www.corcym.com/en/products/memo-3d',27,29,43),
('Corcym','Memo 3D','anel_anuloplastia',30,'Memo 3D 30 mm.','https://www.corcym.com/en/products/memo-3d',29,31,43),
('Corcym','Memo 3D','anel_anuloplastia',32,'Memo 3D 32 mm.','https://www.corcym.com/en/products/memo-3d',31,33,43),
('Corcym','Memo 3D','anel_anuloplastia',34,'Memo 3D 34 mm.','https://www.corcym.com/en/products/memo-3d',33,35,43),
('Corcym','Memo 3D','anel_anuloplastia',36,'Memo 3D 36 mm.','https://www.corcym.com/en/products/memo-3d',35,37,43),
('Corcym','Memo 4D','anel_anuloplastia',26,'Anel mitral Memo 4D com plano de resposta dinâmica.','https://www.corcym.com/en/products/memo-4d',25,27,44),
('Corcym','Memo 4D','anel_anuloplastia',28,'Memo 4D 28 mm.','https://www.corcym.com/en/products/memo-4d',27,29,44),
('Corcym','Memo 4D','anel_anuloplastia',30,'Memo 4D 30 mm.','https://www.corcym.com/en/products/memo-4d',29,31,44),
('Corcym','Memo 4D','anel_anuloplastia',32,'Memo 4D 32 mm.','https://www.corcym.com/en/products/memo-4d',31,33,44),
('Corcym','Memo 4D','anel_anuloplastia',34,'Memo 4D 34 mm.','https://www.corcym.com/en/products/memo-4d',33,35,44),
('Corcym','Memo 4D','anel_anuloplastia',36,'Memo 4D 36 mm.','https://www.corcym.com/en/products/memo-4d',35,37,44);

-- MEDTRONIC ========================================================
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Medtronic','Evolut PRO+','tavi',23,'Válvula transcateter autoexpansível de nitinol supra-anular Evolut PRO+ com skirt externo.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-pro-plus.html',18,20,50),
('Medtronic','Evolut PRO+','tavi',26,'Evolut PRO+ 26 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-pro-plus.html',20,23,50),
('Medtronic','Evolut PRO+','tavi',29,'Evolut PRO+ 29 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-pro-plus.html',23,26,50),
('Medtronic','Evolut PRO+','tavi',34,'Evolut PRO+ 34 mm (large annulus).','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-pro-plus.html',26,30,50),
('Medtronic','Evolut FX','tavi',23,'Evolut FX: geração seguinte com melhorias em posicionamento e depth-guard.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-fx.html',18,20,51),
('Medtronic','Evolut FX','tavi',26,'Evolut FX 26 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-fx.html',20,23,51),
('Medtronic','Evolut FX','tavi',29,'Evolut FX 29 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-fx.html',23,26,51),
('Medtronic','Evolut FX','tavi',34,'Evolut FX 34 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-transcatheter/evolut-fx.html',26,30,51);

INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, display_order) VALUES
('Medtronic','Hancock II','biologica_aortica',21,'Bioprótese aórtica porcina stented Hancock II tratada em glutaraldeído.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',52),
('Medtronic','Hancock II','biologica_aortica',23,'Hancock II 23.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',52),
('Medtronic','Hancock II','biologica_aortica',25,'Hancock II 25.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',52),
('Medtronic','Hancock II','biologica_aortica',27,'Hancock II 27.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',52),
('Medtronic','Hancock II','biologica_aortica',29,'Hancock II 29.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',52),
('Medtronic','Hancock II','biologica_mitral',25,'Bioprótese mitral porcina Hancock II.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',53),
('Medtronic','Hancock II','biologica_mitral',27,'Hancock II mitral 27.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',53),
('Medtronic','Hancock II','biologica_mitral',29,'Hancock II mitral 29.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',53),
('Medtronic','Hancock II','biologica_mitral',31,'Hancock II mitral 31.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',53),
('Medtronic','Hancock II','biologica_mitral',33,'Hancock II mitral 33.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/hancock-ii.html',53),
('Medtronic','Avalus','biologica_aortica',19,'Bioprótese aórtica pericárdica bovina Avalus (visualização fluoroscópica de marcadores).','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/avalus.html',54),
('Medtronic','Avalus','biologica_aortica',21,'Avalus 21.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/avalus.html',54),
('Medtronic','Avalus','biologica_aortica',23,'Avalus 23.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/avalus.html',54),
('Medtronic','Avalus','biologica_aortica',25,'Avalus 25.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/avalus.html',54),
('Medtronic','Avalus','biologica_aortica',27,'Avalus 27.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/avalus.html',54),
('Medtronic','Avalus','biologica_aortica',29,'Avalus 29.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/avalus.html',54),
('Medtronic','Freestyle','biologica_aortica',19,'Bioprótese stentless aórtica porcina Freestyle (raíz completa ou sub-coronária).','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/freestyle.html',55),
('Medtronic','Freestyle','biologica_aortica',21,'Freestyle 21.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/freestyle.html',55),
('Medtronic','Freestyle','biologica_aortica',23,'Freestyle 23.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/freestyle.html',55),
('Medtronic','Freestyle','biologica_aortica',25,'Freestyle 25.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/freestyle.html',55),
('Medtronic','Freestyle','biologica_aortica',27,'Freestyle 27.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/freestyle.html',55),
('Medtronic','Freestyle','biologica_aortica',29,'Freestyle 29.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/freestyle.html',55),
('Medtronic','Open Pivot','mecanica',17,'Válvula mecânica bileaflet Medtronic Open Pivot (ex-ATS) com pivô aberto (não recessado).','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56),
('Medtronic','Open Pivot','mecanica',19,'Open Pivot 19.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56),
('Medtronic','Open Pivot','mecanica',21,'Open Pivot 21.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56),
('Medtronic','Open Pivot','mecanica',23,'Open Pivot 23.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56),
('Medtronic','Open Pivot','mecanica',25,'Open Pivot 25.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56),
('Medtronic','Open Pivot','mecanica',27,'Open Pivot 27.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56),
('Medtronic','Open Pivot','mecanica',29,'Open Pivot 29 (mitral).','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/open-pivot.html',56);

-- Medtronic rings
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Medtronic','Profile 3D','anel_anuloplastia',26,'Anel mitral tridimensional Profile 3D.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',25,27,57),
('Medtronic','Profile 3D','anel_anuloplastia',28,'Profile 3D 28 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',27,29,57),
('Medtronic','Profile 3D','anel_anuloplastia',30,'Profile 3D 30 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',29,31,57),
('Medtronic','Profile 3D','anel_anuloplastia',32,'Profile 3D 32 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',31,33,57),
('Medtronic','Profile 3D','anel_anuloplastia',34,'Profile 3D 34 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',33,35,57),
('Medtronic','Profile 3D','anel_anuloplastia',36,'Profile 3D 36 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',35,37,57),
('Medtronic','CG Future','anel_anuloplastia',26,'Anel mitral CG Future com segmento posterior flexível.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',25,27,58),
('Medtronic','CG Future','anel_anuloplastia',28,'CG Future 28 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',27,29,58),
('Medtronic','CG Future','anel_anuloplastia',30,'CG Future 30 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',29,31,58),
('Medtronic','CG Future','anel_anuloplastia',32,'CG Future 32 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',31,33,58),
('Medtronic','CG Future','anel_anuloplastia',34,'CG Future 34 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',33,35,58),
('Medtronic','Contour 3D','anel_anuloplastia',26,'Anel tricúspide Contour 3D reproduzindo geometria não planar.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',25,27,59),
('Medtronic','Contour 3D','anel_anuloplastia',28,'Contour 3D 28 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',27,29,59),
('Medtronic','Contour 3D','anel_anuloplastia',30,'Contour 3D 30 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',29,31,59),
('Medtronic','Contour 3D','anel_anuloplastia',32,'Contour 3D 32 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',31,33,59),
('Medtronic','Contour 3D','anel_anuloplastia',34,'Contour 3D 34 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',33,35,59),
('Medtronic','Contour 3D','anel_anuloplastia',36,'Contour 3D 36 mm.','https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves-surgical/annuloplasty-rings.html',35,37,59);

-- BRAILE (Brasil) ==================================================
INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, annulus_min_mm, annulus_max_mm, display_order) VALUES
('Braile','Inovare','tavi',20,'Válvula transcateter balão-expansível Braile Inovare, pericárdio bovino, fabricação nacional (São José do Rio Preto/SP).','https://brailebiomedica.com.br/produto/valvas-cardiacas-transcateter-inovare/',18,20,70),
('Braile','Inovare','tavi',22,'Inovare 22 mm.','https://brailebiomedica.com.br/produto/valvas-cardiacas-transcateter-inovare/',20,22,70),
('Braile','Inovare','tavi',24,'Inovare 24 mm.','https://brailebiomedica.com.br/produto/valvas-cardiacas-transcateter-inovare/',22,24,70),
('Braile','Inovare','tavi',26,'Inovare 26 mm.','https://brailebiomedica.com.br/produto/valvas-cardiacas-transcateter-inovare/',24,26,70),
('Braile','Inovare','tavi',28,'Inovare 28 mm.','https://brailebiomedica.com.br/produto/valvas-cardiacas-transcateter-inovare/',26,28,70),
('Braile','Inovare','tavi',30,'Inovare 30 mm.','https://brailebiomedica.com.br/produto/valvas-cardiacas-transcateter-inovare/',28,30,70);

INSERT INTO public.prosthesis_catalog (manufacturer, model_name, type, size, description, reference_url, display_order) VALUES
('Braile','Biocor','biologica_aortica',19,'Bioprótese aórtica cirúrgica de pericárdio bovino Braile Biocor.','https://brailebiomedica.com.br/',71),
('Braile','Biocor','biologica_aortica',21,'Biocor aórtica 21 mm.','https://brailebiomedica.com.br/',71),
('Braile','Biocor','biologica_aortica',23,'Biocor aórtica 23 mm.','https://brailebiomedica.com.br/',71),
('Braile','Biocor','biologica_aortica',25,'Biocor aórtica 25 mm.','https://brailebiomedica.com.br/',71),
('Braile','Biocor','biologica_aortica',27,'Biocor aórtica 27 mm.','https://brailebiomedica.com.br/',71),
('Braile','Biocor','biologica_mitral',25,'Bioprótese mitral pericárdica Braile Biocor.','https://brailebiomedica.com.br/',72),
('Braile','Biocor','biologica_mitral',27,'Biocor mitral 27 mm.','https://brailebiomedica.com.br/',72),
('Braile','Biocor','biologica_mitral',29,'Biocor mitral 29 mm.','https://brailebiomedica.com.br/',72),
('Braile','Biocor','biologica_mitral',31,'Biocor mitral 31 mm.','https://brailebiomedica.com.br/',72),
('Braile','Biocor','biologica_mitral',33,'Biocor mitral 33 mm.','https://brailebiomedica.com.br/',72);
