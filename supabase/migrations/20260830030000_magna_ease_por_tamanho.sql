-- A Magna Ease deixa de ter 2 de 6 tamanhos com EOA e passa a ter 5
--
-- ## O que estava faltando, e por quê
--
-- A Magna Ease é a única PERIMOUNT que a Edwards ainda vende, e o catálogo só
-- tinha EOA em dois dos seis tamanhos. O motivo não era desleixo: a fonte usada
-- (Mayr 2021) traz os seis tamanhos, mas com n=2 no 19 mm, n=6 no 21, n=4 no 27
-- e **n=1** no 29 — abaixo do piso de amostra desta base (`N_MINIMO = 10`, em
-- `src/data/buscaDeFontes.ts`). O piso existe porque no ensaio Dafodil-1 o 23 mm
-- (n=3) marcou EOA maior que o 25 mm (n=3): a curva inverte, e ruído de amostra
-- pequena viraria recomendação de prótese.
--
-- Tsui et al. 2022 resolve isso com uma coorte muito maior, na mesma medida (na
-- alta hospitalar) e com a tabela por tamanho:
--
--     19 mm  n=9    1,3 ± 0,37 cm²   19,2 ± 4,72 mmHg   ← abaixo do piso
--     21 mm  n=34   1,5 ± 0,42       16,7 ± 6,21
--     23 mm  n=87   1,7 ± 0,36       13,8 ± 5,00
--     25 mm  n=66   1,9 ± 0,59       13,5 ± 5,42
--     27 mm  n=19   2,3 ± 0,67        9,5 ± 3,79
--     29 mm  n=11   2,5 ± 0,61        9,4 ± 2,43
--
-- O 23 e o 25 já tinham valor, vindos de Mayr (n=17 e n=27). São substituídos
-- pelos de Tsui, que medem a mesma coisa em coorte cinco vezes maior. Não é que
-- os de Mayr estivessem errados; é que estes são melhores, e a fonte citada na
-- tela passa a dizer qual foi usada.
--
-- ## O 19 mm continua vazio, e isso é de propósito
--
-- n=9. Um paciente abaixo do piso. Baixar o piso para dez virar nove porque um
-- caso específico ficou de fora é como a régua deixa de existir — e o 19 mm é
-- justamente o tamanho onde o mismatch decide conduta, ou seja, o pior lugar
-- para relaxar o critério. Fica vazio, com o motivo registrado.

UPDATE public.prosthesis_catalog SET
  effective_orifice_area = t.eoa,
  eoa_reference_sd = t.eoa_dp,
  mean_gradient_ref = t.grad,
  mean_gradient_ref_sd = t.grad_dp,
  eoa_source_label = 'Tsui 2022 — alta hospitalar, por tamanho, n = ' || t.n,
  eoa_source_url = 'https://pubmed.ncbi.nlm.nih.gov/36378942/'
 FROM (VALUES
     (21, 34, 1.5::numeric, 0.42::numeric, 16.7::numeric, 6.21::numeric),
     (23, 87, 1.7::numeric, 0.36::numeric, 13.8::numeric, 5.00::numeric),
     (25, 66, 1.9::numeric, 0.59::numeric, 13.5::numeric, 5.42::numeric),
     (27, 19, 2.3::numeric, 0.67::numeric,  9.5::numeric, 3.79::numeric),
     (29, 11, 2.5::numeric, 0.61::numeric,  9.4::numeric, 2.43::numeric)
   ) AS t(size, n, eoa, eoa_dp, grad, grad_dp)
 WHERE prosthesis_catalog.manufacturer = 'Edwards'
   AND prosthesis_catalog.model_name = 'Magna Ease'
   AND prosthesis_catalog.valve_position = 'aortica'
   AND prosthesis_catalog.size = t.size;
