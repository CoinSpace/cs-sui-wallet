export default class API {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async #requestNode(config) {
    const data = await this.#wallet.requestNode(config);
    return data;
  }

  async getObjects(token = '0x2::sui::SUI') {
    const objects = [];
    let res;
    do {
      res = await this.#requestNode({
        url: `api/v1/token/${token}/${this.#wallet.address}/objects`,
        method: 'GET',
        params: {
          cursor: res?.nextCursor,
          limit: this.#wallet.txPerPage,
        },
      });
      objects.push(...res.data);
    } while (res?.hasNextPage);
    return objects;
  }

  async getGasPrice() {
    const { price } = await this.#requestNode({
      url: 'api/v1/gas/price',
      method: 'GET',
    });
    return BigInt(price);
  }

  async dryRunTransaction(transaction) {
    const res = await this.#requestNode({
      url: 'api/v1/transaction/dry-run',
      method: 'POST',
      data: { transaction },
    });
    return res;
  }

  async executeTransaction(transaction, signature) {
    const res = await this.#requestNode({
      url: 'api/v1/transaction/send',
      method: 'POST',
      data: { transaction, signature },
    });
    return res;
  }

  async getTransactions(address, cursor, limit) {
    const res = await this.#requestNode({
      url: `api/v1/address/${address}/transactions`,
      method: 'GET',
      params: {
        cursor,
        limit,
      },
    });
    return res;
  }

  async unalias(alias) {
    const res = await this.#requestNode({
      url: 'api/v1/unalias',
      method: 'GET',
      params: {
        alias,
      },
    });
    return res;
  }
}
