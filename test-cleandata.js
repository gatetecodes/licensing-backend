const obj = {
  institution_name: 'Bank',
  capital_amount_rwf: undefined,
  incorporation_date: "",
  business_summary: 0
};
const cleaned = Object.fromEntries(
  Object.entries(obj).map(([key, value]) => [
    key,
    value === "" ? null : value,
  ]),
);
console.log(JSON.stringify(cleaned));
