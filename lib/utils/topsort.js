import DAG from 'dag-map';

export default function topsort(items, options = {}) {
  let graph = new DAG();
  items.forEach((item) => {
    let value = options.valueKey ? item[options.valueKey] : item;
    graph.add(item.name, value, item.before, item.after);
  });
  let sorted = [];
  graph.topsort(({ value }) => {
    sorted.push(value);
  });
  return sorted;
}
