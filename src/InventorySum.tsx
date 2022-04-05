import React from 'react';
import { Table } from './components';
import { InventoryDetail } from './types';

const InventorySum: React.FC<{ inventoryDetails: InventoryDetail[] }> = ({ inventoryDetails }) => {
  const getSums = () => {
    const sums = new Map<number, { quantity: number; amount: number }>();
    for (const detail of inventoryDetails) {
      if (detail.costPrice && detail.quantity) {
        if (detail.stockTax !== undefined) {
          const sum = sums.get(detail.stockTax) ?? { quantity: 0, amount: 0 };
          sum.quantity += detail.quantity;
          sum.amount += detail.quantity * detail.costPrice;
          sums.set(detail.stockTax, sum);
        }
        const sum0 = sums.get(100) ?? { quantity: 0, amount: 0 };
        sum0.quantity += detail.quantity;
        sum0.amount += detail.quantity * detail.costPrice;
        sums.set(100, sum0);
      }
    }
    return Array.from(sums.entries()).sort((v1, v2) => v1[0] - v2[0]);
  };
  const sums = getSums();

  if (sums.length === 0) return null;

  return (
    <Table size="sm">
      <Table.Head>
        <Table.Row>
          <Table.Cell></Table.Cell>
          <Table.Cell>実数</Table.Cell>
          <Table.Cell>金額</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sums.map(([tax, value]) => (
          <Table.Row>
            <Table.Cell>{tax === 100 ? '合計' : `${tax}%商品`}</Table.Cell>
            <Table.Cell className="text-right">{value.quantity}</Table.Cell>
            <Table.Cell className="text-right">{value.amount.toLocaleString()}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

export default InventorySum;
