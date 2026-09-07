import { describe, it, expect, vi } from "vitest";

/**
 * `homeDoUsuario` é função pura, mas mora ao lado de `resolverHome`, que importa
 * o cliente do Supabase. Esse cliente é construído no momento do import e exige
 * `VITE_SUPABASE_URL` — que existe na máquina de quem desenvolve, por causa do
 * `.env`, e **não** existe no CI. Sem este mock o arquivo nem chega a rodar:
 * quebra no import com "supabaseUrl is required", e o teste passa localmente
 * enquanto o CI fica vermelho.
 */
/**
 * O mock deixou de ser `{}` porque `resolverHome` passou a ser testada de
 * verdade. As respostas de cada tabela são configuradas por teste em
 * `respostas`, e o construtor de consulta devolve a si mesmo até o
 * `maybeSingle()` — que é a forma como o cliente do Supabase encadeia.
 */
const respostas: Record<string, { data: unknown; error: unknown }> = {};

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const alvo: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "is", "order", "limit"]) {
      alvo[metodo] = () => alvo;
    }
    alvo.maybeSingle = () =>
      Promise.resolve(respostas[tabela] ?? { data: null, error: null });
    return alvo;
  };
  return {
    supabase: {
      from: (tabela: string) => consulta(tabela),
      rpc: (nome: string) =>
        Promise.resolve(respostas[nome] ?? { data: null, error: null }),
    },
  };
});

import { homeDoUsuario, resolverHome, HOME_ADMIN, HOME_MEDICO, HOME_PACIENTE } from "./homeDoUsuario";

describe("homeDoUsuario", () => {
  // O caso que motivou o helper: a conta de administrador é obrigada a declarar
  // `account_type = 'medico'` (o CHECK do banco só aceita medico/paciente), e
  // por isso caía num painel de médico vazio pedindo cadastro clínico.
  it("admin sem registro clínico vai para o painel de administração", () => {
    expect(
      homeDoUsuario({ accountType: "medico", ehAdmin: true, temRegistroClinico: false }),
    ).toBe(HOME_ADMIN);
  });

  // Quem realmente atende continua caindo na área clínica: o menu de
  // administração é somado ao dela, não trocado por ele.
  it("admin que também tem registro de médico vai para a área clínica", () => {
    expect(
      homeDoUsuario({ accountType: "medico", ehAdmin: true, temRegistroClinico: true }),
    ).toBe(HOME_MEDICO);
  });

  // A distinção que impede o desvio de pegar quem não devia: um médico
  // recém-cadastrado ainda não tem linha em `doctors` e precisa da área clínica
  // justamente para criá-la.
  it("médico recém-cadastrado, sem registro ainda, vai para a área clínica", () => {
    expect(
      homeDoUsuario({ accountType: "medico", ehAdmin: false, temRegistroClinico: false }),
    ).toBe(HOME_MEDICO);
  });

  it("paciente vai para a área do paciente", () => {
    expect(
      homeDoUsuario({ accountType: "paciente", ehAdmin: false, temRegistroClinico: true }),
    ).toBe(HOME_PACIENTE);
  });

  it("sem perfil conhecido, cai na área do paciente (o menos privilegiado)", () => {
    expect(homeDoUsuario({ accountType: null, ehAdmin: false, temRegistroClinico: false })).toBe(
      HOME_PACIENTE,
    );
  });

  it("admin paciente sem registro também vai para o painel", () => {
    expect(
      homeDoUsuario({ accountType: "paciente", ehAdmin: true, temRegistroClinico: false }),
    ).toBe(HOME_ADMIN);
  });
});

/**
 * `resolverHome` diante de falha de leitura.
 *
 * Estas quatro leituras descartavam o `error`, e o efeito não era tela feia: a
 * pessoa aterrissava na área errada logo depois de "Entrar". O caso mais grave
 * é o `profiles` falhando — `account_type` vira nulo e o MÉDICO CAI NA ÁREA DO
 * PACIENTE, onde não vê nenhum dos seus casos e conclui que perdeu o cadastro.
 *
 * O contador de `readErrors` não prova isto. Ele conta padrões no código; estes
 * testes cobram o comportamento.
 */
describe("resolverHome quando a leitura falha", () => {
  const limpar = () => {
    for (const k of Object.keys(respostas)) delete respostas[k];
  };

  it("recusa quando não consegue ler o perfil — em vez de mandar médico para a área do paciente", async () => {
    limpar();
    respostas.profiles = { data: null, error: { message: "network" } };
    await expect(resolverHome("u1")).rejects.toThrow(/perfil/i);
  });

  it("recusa quando não consegue ler as permissões — o admin não cai no painel de médico vazio", async () => {
    limpar();
    respostas.has_role = { data: null, error: { message: "timeout" } };
    await expect(resolverHome("u1")).rejects.toThrow(/permiss/i);
  });

  it("recusa quando falha o registro clínico, que decide o destino do admin", async () => {
    limpar();
    respostas.doctors = { data: null, error: { message: "rls" } };
    await expect(resolverHome("u1")).rejects.toThrow(/registro médico/i);
  });

  it("a mensagem nomeia TUDO o que falhou, não só a primeira", async () => {
    // Quem lê a mensagem precisa saber o tamanho do problema. "Não foi possível
    // carregar perfil" quando também falharam permissões manda a pessoa tentar
    // de novo achando que é coisa pequena.
    limpar();
    respostas.profiles = { data: null, error: { message: "x" } };
    respostas.has_role = { data: null, error: { message: "y" } };
    await expect(resolverHome("u1")).rejects.toThrow(/perfil, permissões/i);
  });

  it("sem falha nenhuma, continua resolvendo o destino normalmente", async () => {
    // Contraprova: uma função que rejeitasse sempre passaria nos quatro testes
    // acima e quebraria o login inteiro.
    limpar();
    respostas.profiles = { data: { account_type: "medico" }, error: null };
    respostas.has_role = { data: false, error: null };
    await expect(resolverHome("u1")).resolves.toBe(HOME_MEDICO);
  });

  it("paciente sem nada falhando vai para a área do paciente", async () => {
    limpar();
    respostas.profiles = { data: { account_type: "paciente" }, error: null };
    respostas.has_role = { data: false, error: null };
    await expect(resolverHome("u1")).resolves.toBe(HOME_PACIENTE);
  });
});
