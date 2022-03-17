import React from 'react';
import { Table } from './components';
import { Inventory } from './types';

const InventorySum: React.FC<{ inventory: Inventory }> = ({ inventory }) => {
  const getItems = () => {
    return Object.entries(inventory.sum).sort(([k1], [k2]) => (+k2 === 0 ? -1 : +k1 - +k2));
  };

  if (Object.keys(inventory.sum).length === 0) return null;

  return (
    <Table size="sm">
      <Table.Head>
        <Table.Row>
          <Table.Cell></Table.Cell>
          <Table.Cell>差異</Table.Cell>
          <Table.Cell>金額</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {getItems().map(([tax, value]) => (
          <Table.Row>
            <Table.Cell>{+tax === 0 ? '合計' : `${tax}%商品`}</Table.Cell>
            <Table.Cell className="text-right">{value.quantity}</Table.Cell>
            <Table.Cell className="text-right">{value.amount.toLocaleString()}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

export default InventorySum;
