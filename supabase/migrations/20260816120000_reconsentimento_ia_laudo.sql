-- O consentimento de IA precisa ser pedido de novo: o texto mudou de sentido.
--
-- O texto anterior dizia que os dados iam ao Google "— sem meu nome". Isso era
-- verdade para um dos dois caminhos e falso para o outro: quando o médico anexa
-- o laudo para leitura automática, **o arquivo é enviado inteiro**, e um laudo
-- traz nome, data de nascimento e número de registro impressos. O campo do caso
-- sempre foi minimizado (vai o marcador `[NOME_PACIENTE]`); o documento nunca
-- esteve.
--
-- Manter as concessões antigas válidas sob o texto novo seria tratar como
-- consentida uma coisa que ninguém leu — fabricar consentimento, que é
-- exatamente o que uma trilha de LGPD existe para impedir. Então elas são
-- revogadas aqui, com o motivo registrado, e o titular vê a parede de
-- consentimento outra vez, agora com o texto correto.
--
-- Alcance conferido antes de aplicar: 1 concessão ativa.

insert into public.consent_audit_log (user_id, consent_type, action, document_version, source, metadata)
select user_id, 'ai_processing', 'revoked', document_version, 'migration',
       jsonb_build_object(
         'motivo', 'texto do consentimento mudou de sentido: o laudo anexado vai inteiro ao provedor de IA',
         'versao_anterior', document_version,
         'versao_nova', '2.3')
  from public.user_consents
 where consent_type = 'ai_processing' and granted and revoked_at is null;

update public.user_consents
   set revoked_at = now()
 where consent_type = 'ai_processing' and granted and revoked_at is null;
