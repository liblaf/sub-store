type HasName = {
  name: string;
};

export function getName(obj: HasName): string {
  return obj.name;
}

type HasPretty = {
  pretty: string;
};

export function getPretty(obj: HasPretty): string {
  return obj.pretty;
}
