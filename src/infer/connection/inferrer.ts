import type { Country } from "world-countries";
import type { GeoIP } from "../../geoip";
import { Connection, type Outbound } from "../../outbound";

export class ConnectionInferrer {
  geoip?: GeoIP;

  constructor(geoip?: GeoIP) {
    this.geoip = geoip;
  }

  async infer(outbound: Outbound): Promise<Connection | undefined> {
    let connection: Connection | undefined;
    connection = this.inferFromName(outbound);
    if (connection) return connection;
    connection = await this.inferFromServer(outbound);
    if (connection) return connection;
  }

  protected inferFromName(outbound: Outbound): Connection | undefined {
    if (outbound.name.match(/直连/)) return Connection.DIRECT;
    if (outbound.name.match(/隧道/)) return Connection.TRANSIT;
  }

  protected async inferFromServer(
    outbound: Outbound,
  ): Promise<Connection | undefined> {
    const country: Country | undefined = await this.geoip?.lookup(
      outbound.server,
    );
    if (!country) return undefined;
    if (country.cca2 === "CN") return Connection.DIRECT;
    else return Connection.TRANSIT;
  }
}
