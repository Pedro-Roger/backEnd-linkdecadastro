import { Injectable } from '@nestjs/common';

type StateOption = {
  sigla: string;
  nome: string;
};

type CityOption = {
  nome: string;
};

type CepLookupResult = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
};

const FALLBACK_STATES: StateOption[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapa' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceara' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espirito Santo' },
  { sigla: 'GO', nome: 'Goias' },
  { sigla: 'MA', nome: 'Maranhao' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Para' },
  { sigla: 'PB', nome: 'Paraiba' },
  { sigla: 'PR', nome: 'Parana' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piaui' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondonia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'Sao Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

@Injectable()
export class LocationsService {
  private readonly cache = new Map<string, { expiresAt: number; value: any }>();
  private readonly ttlMs = 1000 * 60 * 60 * 6;

  private readCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private writeCache(key: string, value: any) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LinkDeCadastro/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async trySources<T>(sources: string[]): Promise<T> {
    let lastError: unknown;

    for (const source of sources) {
      try {
        return await this.fetchJson<T>(source);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Falha ao consultar localidades');
  }

  async listStates() {
    const cacheKey = 'states';
    const cached = this.readCache<StateOption[]>(cacheKey);
    if (cached) return cached;

    try {
      const states = await this.trySources<StateOption[]>([
        'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome',
      ]);
      this.writeCache(cacheKey, states);
      return states;
    } catch (error) {
      this.writeCache(cacheKey, FALLBACK_STATES);
      return FALLBACK_STATES;
    }
  }

  async listCities(stateSigla: string) {
    const normalizedState = (stateSigla || '').trim().toUpperCase();
    if (!normalizedState) return [];

    const cacheKey = `cities:${normalizedState}`;
    const cached = this.readCache<CityOption[]>(cacheKey);
    if (cached) return cached;

    const cities = await this.trySources<CityOption[]>([
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedState}/municipios`,
    ]);

    const sorted = [...cities].sort((a, b) => a.nome.localeCompare(b.nome));
    this.writeCache(cacheKey, sorted);
    return sorted;
  }

  async lookupCep(cep: string): Promise<CepLookupResult | null> {
    const normalizedCep = (cep || '').replace(/\D/g, '');
    if (normalizedCep.length !== 8) return null;

    const cacheKey = `cep:${normalizedCep}`;
    const cached = this.readCache<CepLookupResult>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.trySources<any>([
        `https://brasilapi.com.br/api/cep/v1/${normalizedCep}`,
        `https://viacep.com.br/ws/${normalizedCep}/json/`,
      ]);

      if (data?.erro) {
        return null;
      }

      const result: CepLookupResult = {
        cep: normalizedCep,
        state: data.state || data.uf || '',
        city: data.city || data.localidade || '',
        neighborhood: data.neighborhood || data.bairro || '',
        street: data.street || data.logradouro || '',
      };

      this.writeCache(cacheKey, result);
      return result;
    } catch (error) {
      return null;
    }
  }
}
