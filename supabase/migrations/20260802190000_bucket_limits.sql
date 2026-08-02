-- Teto de tamanho e restrição de tipo nos buckets de documento.
--
-- Até aqui os três buckets tinham `file_size_limit` e `allowed_mime_types`
-- nulos: nenhum limite no servidor. A única restrição era o atributo `accept`
-- dos formulários — que é dica de interface, ignorada por completo por uma
-- chamada direta à API do storage. Na prática dava para enviar qualquer coisa,
-- de qualquer tamanho.
--
-- Consequências: um envio de vários GB enche o armazenamento e a conta sem
-- nenhum freio, e um HTML gravado como "documento" abre renderizado para quem
-- seguir a URL assinada. O bucket privado e a URL curta reduzem o alcance, mas
-- nenhum dos dois impede o envio.
--
-- Momento certo: os dois buckets de documento estão vazios, então nenhuma
-- regra nova invalida arquivo já existente.

update storage.buckets
   set file_size_limit = 50 * 1024 * 1024,   -- DICOM costuma ser grande
       allowed_mime_types = array[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'application/dicom',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 where id = 'medical-documents';

update storage.buckets
   set file_size_limit = 25 * 1024 * 1024,
       allowed_mime_types = array[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 where id = 'patient-documents';

-- `clinical-exports` fica deliberadamente sem teto.
--
-- Só o service_role escreve nele (a função de backup), então não há superfície
-- de abuso. E um limite de tamanho ali quebraria o backup em silêncio no dia em
-- que uma tabela crescesse além do teto — exatamente a classe de falha que esta
-- sessão passou inteira consertando. O ganho não compensa o risco.
