import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Dropdown,
  Flex,
  Form,
  Grid,
  Icon,
  Modal,
  Pagination,
  Progress,
  Table,
  Tabs,
  Tooltip,
  ThemeProvider,
  Navbar,
} from './components';
import { Brand, Size } from './components/type';
import './App.css';

type TabProp = {
  variant: 'line' | 'bar';
  size: 'sm' | 'md';
};

function Tailwind() {
  const [value, setValue] = useState('0');
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<TabProp>({ variant: 'line', size: 'sm' });
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const [page, setPage] = useState(5);
  const [pagerSize, setPagerSize] = useState<'sm' | 'md'>('md');

  useEffect(() => {
    setInterval(() => setProgress((prev) => (prev + 1) % 100), 50);
  }, []);

  const title = `You own your list, forever
Bring the audience you’ve built,
and take it with you anytime.
You are in control.`;

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };

  return (
    <ThemeProvider>
      <Navbar fixed className="bg-white flex justify-between h-12">
        <Tabs
          value={value}
          variant="line"
          size="sm"
          baseLine={false}
          onChange={handleChange}
        >
          <Tabs.Tab label="Tab" disabled value="" />
          <Tabs.Tab label="Tab1" icon={<Icon name="bell" />} value="0" />
          <Tabs.Tab label="Tab2" icon={<Icon name="exclamation" />} value="1" />
          <Tabs.Tab label="Tab3" icon={<Icon name="book-open" />} value="2" />
        </Tabs>
        <Dropdown
          icon={
            <Button
              variant="icon"
              size="xs"
              color="none"
              className="m-3 text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-gray-400"
            >
              <Icon name="dots-vertical" />
            </Button>
          }
          align="right"
        >
          <Dropdown.Item title="menu1" onClick={() => alert('menu1 Clicked')} />
          <Dropdown.Item title="menu2" onClick={() => alert('menu2 Clicked')} />
          <Dropdown.Divider />
          <Dropdown.Item title="menu3" onClick={() => alert('menu3 Clicked')} />
        </Dropdown>
      </Navbar>
      <div className="mx-auto container mt-14 p-1">
        <Card className="m-8">
          <Card.Header>Button</Card.Header>
          <Card.Body className="bg-gray-50">
            <Flex className="items-center">
              <div className="w-20">contained</div>
              {[
                'primary',
                'secondary',
                'success',
                'danger',
                'warning',
                'info',
                'light',
                'dark',
                'none',
              ].map((brand, i) => (
                <Button key={i} color={brand as Brand} className="m-1">
                  {brand}
                </Button>
              ))}
            </Flex>
            <Flex className="items-center">
              <div className="w-20">outlined</div>
              {[
                'primary',
                'secondary',
                'success',
                'danger',
                'warning',
                'info',
                'light',
                'dark',
                'none',
              ].map((brand, i) => (
                <Button
                  key={i}
                  variant="outlined"
                  color={brand as Brand}
                  className="m-1"
                >
                  {brand}
                </Button>
              ))}
            </Flex>
            <Flex className="items-center">
              <div className="w-20">Text</div>
              {[
                'primary',
                'secondary',
                'success',
                'danger',
                'warning',
                'info',
                'light',
                'dark',
                'none',
              ].map((brand, i) => (
                <Button
                  key={i}
                  variant="text"
                  color={brand as Brand}
                  className="m-1"
                >
                  {brand}
                </Button>
              ))}
            </Flex>
            <Flex className="items-center">
              <div className="w-20">Size</div>
              {['xs', 'sm', 'md', 'lg', 'xl'].map((size, i) => (
                <Button key={i} size={size as Size} className="mx-2 my-1">
                  Size={size}
                </Button>
              ))}
            </Flex>
            <Flex className="items-center">
              <div className="w-20">Icon</div>
              {['information-circle', 'bell', 'book-open', 'trash'].map(
                (name, i) => (
                  <Button
                    key={i}
                    variant="icon"
                    size="sm"
                    className="mx-2 my-1"
                  >
                    <Icon name={name} />
                  </Button>
                )
              )}
            </Flex>
          </Card.Body>
        </Card>
        <Card className="m-8 overflow-visible">
          <Card.Header>Pagination</Card.Header>
          <Card.Body className="p-4 bg-gray-50 text-center">
            <Pagination
              count={10}
              page={page}
              size={pagerSize}
              onChange={(p) => setPage(p)}
            />
          </Card.Body>
          <Card.Footer>
            <Flex className="space-x-2 items-center">
              <div>Parameters</div>
              <Form.Select
                id="select"
                size="md"
                className="mb-3 sm:mb-0"
                value={pagerSize}
                options={['sm', 'md']}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'sm' || value === 'md') setPagerSize(value);
                }}
              />
            </Flex>
          </Card.Footer>
        </Card>
        <Card className="m-8 overflow-visible">
          <Card.Header>Tooltip</Card.Header>
          <Card.Body className="p-4 bg-gray-50 text-center">
            <Tooltip title={title} className="text-left">
              <Button color="primary">Hover me</Button>
            </Tooltip>
          </Card.Body>
        </Card>
        <Card className="m-8 overflow-visible">
          <Card.Header>Dropdown</Card.Header>
          <Card.Body className="p-4 bg-gray-50 text-center">
            <Dropdown
              icon={<Button color="primary">Click me</Button>}
              align={align}
            >
              <Dropdown.Item title="menu1 ABCDEFG">
                <Dropdown.Item
                  title="sub_menu1"
                  onClick={() => alert('sub_menu1 Clicked')}
                />
                <Dropdown.Item title="sub_menu2" />
                <Dropdown.Divider />
                <Dropdown.Item title="sub_menu3">
                  <Dropdown.Item
                    title="sub_sub_menu1"
                    onClick={() => alert('sub_sub_menu1 Clicked')}
                  />
                  <Dropdown.Item
                    title="sub_sub_menu2"
                    onClick={() => alert('sub_sub_menu2 Clicked')}
                  />
                </Dropdown.Item>
              </Dropdown.Item>
              <Dropdown.Item
                title="menu2 BBB"
                onClick={() => alert('menu2 Clicked')}
              />
              <Dropdown.Divider />
              <Dropdown.Item
                title="menu3 CCC"
                onClick={() => alert('menu3 Clicked')}
              />
            </Dropdown>
          </Card.Body>
          <Card.Footer>
            <Flex className="space-x-2 items-center">
              <div>Parameters</div>
              <Form.Select
                id="select"
                size="md"
                className="mb-3 sm:mb-0"
                value={align}
                options={['left', 'right']}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'left' || value === 'right') setAlign(value);
                }}
              />
            </Flex>
          </Card.Footer>
        </Card>
        <Card className="m-8 overflow-visible">
          <Card.Header>Grid</Card.Header>
          <Card.Body className="p-3 bg-gray-50">
            <Grid cols="2 md:4" rows="4 md:2" gap="3" flow="col">
              {[...Array(8)].map((_, i) => (
                <Tooltip key={i} title={`Card-${i + 1}`}>
                  <Card className="h-20">{`Card-${i + 1}`}</Card>
                </Tooltip>
              ))}
            </Grid>
          </Card.Body>
        </Card>
        <Card className="m-8">
          <Card.Header>Modal</Card.Header>
          <Card.Body className="p-3 bg-gray-50 text-center">
            <Button color="primary" onClick={() => setOpen(true)}>
              Open Modal
            </Button>

            <Modal open={open} size="md" onClose={() => setOpen(false)}>
              <Modal.Header centered={false} onClose={() => setOpen(false)}>
                Deactivate account
              </Modal.Header>
              <Modal.Body>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to deactivate your account? All of
                        your data will be permanently removed. This action
                        cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end">
                <Button
                  color="secondary"
                  variant="outlined"
                  className="mr-3"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button color="danger">Deactive</Button>
              </Modal.Footer>
            </Modal>
          </Card.Body>
        </Card>
        <Card className="m-8">
          <Tabs
            value={value}
            variant={tab.variant}
            size={tab.size}
            onChange={handleChange}
          >
            <Tabs.Tab label="Tab" disabled value="" />
            <Tabs.Tab label="Tab1" icon={<Icon name="bell" />} value="0" />
            <Tabs.Tab
              label="Tab2"
              icon={<Icon name="exclamation" />}
              value="1"
            />
            <Tabs.Tab label="Tab3" icon={<Icon name="book-open" />} value="2" />
          </Tabs>
          <Card.Body className="bg-gray-50">
            <div className="p-4">
              {value === '0' && (
                <p>
                  My mistress eyes are nothing like the sun; Coral is far more
                  red, than her lips red: If snow be white, why then her breasts
                  are dun; If hairs be wires, black wires grow on her head. I
                  have seen roses damaskd, red and white, But no such roses see
                  I in her cheeks; And in some perfumes is there more delight
                  Than in the breath that from my mistress reeks. I love to hear
                  her speak, yet well I know That music hath a far more pleasing
                  sound:
                </p>
              )}
              {value === '1' && (
                <p>
                  No more be grievd at that which thou hast done: Roses have
                  thorns, and silver fountains mud: Clouds and eclipses stain
                  both moon and sun, And loathsome canker lives in sweetest bud.
                  All men make faults, and even I in this, Authorizing thy
                  trespass with compare, Myself corrupting, salving thy amiss,
                  Excusing thy sins more than thy sins are; For to thy sensual
                  fault I bring in sense,-- Thy adverse party is thy advocate,--
                </p>
              )}
              {value === '2' && <p>AAA</p>}
            </div>
          </Card.Body>
          <Card.Footer>
            <Flex className="space-x-2 items-center">
              <div>Parameters</div>
              <Form.Select
                id="select"
                size="md"
                className="mb-3 sm:mb-0"
                label="-- variant --"
                value={tab.variant}
                options={[
                  { value: 'line', label: 'line' },
                  { value: 'bar', label: 'bar' },
                ]}
                onChange={(e) =>
                  setTab((prev) => ({
                    ...prev,
                    variant: e.target.value as 'line' | 'bar',
                  }))
                }
              />
              <Form.Select
                id="select"
                size="md"
                className="mb-3 sm:mb-0"
                label="-- size --"
                value={tab.size}
                options={[
                  { value: 'sm', label: 'sm' },
                  { value: 'md', label: 'md' },
                ]}
                onChange={(e) =>
                  setTab((prev) => ({
                    ...prev,
                    size: e.target.value as 'sm' | 'md',
                  }))
                }
              />
            </Flex>
          </Card.Footer>
        </Card>
        <Card className="m-8">
          <Card.Header>Form</Card.Header>
          <Card.Body className="p-4 bg-gray-50">
            <Form className="">
              <Grid cols="1 sm:2" gap="0 sm:3" className="max-w-xl">
                <Form.Label htmlFor="text">Form.Text</Form.Label>
                <Form.Text
                  id="text"
                  size="md"
                  placeholder="Text"
                  className="mb-3 sm:mb-0"
                />
                <Form.Label htmlFor="number">Form.Number</Form.Label>
                <Form.Number
                  id="number"
                  size="md"
                  placeholder="Number"
                  className="mb-3 sm:mb-0"
                />
                <Form.Label htmlFor="date">Form.Date</Form.Label>
                <Form.Date
                  id="date"
                  size="md"
                  placeholder="Date"
                  className="mb-3 sm:mb-0"
                />
                <Form.Label htmlFor="textarea">Form.TextArea</Form.Label>
                <Form.TextArea
                  id="textarea"
                  placeholder="TextArea"
                  rows={5}
                  className="mb-3 sm:mb-0"
                />
                <Form.Label htmlFor="select">Form.Select</Form.Label>
                <Form.Select
                  id="select"
                  size="md"
                  className="mb-3 sm:mb-0"
                  label="-- Country --"
                  options={[
                    { value: '1', label: 'United States' },
                    { value: '2', label: 'Canada' },
                    { value: '3', label: 'Mexico' },
                  ]}
                />
                <div></div>
                <Form.Checkbox
                  id="checkbox"
                  size="md"
                  label="Form.Checkbox"
                  className="mb-3 sm:mb-0"
                />
                <div></div>
                <Grid cols="2" gap="2">
                  <Form.Radio
                    id="radio1"
                    name="radio"
                    size="md"
                    label="Form.Radio1"
                    className="mb-3 sm:mb-0"
                  />
                  <Form.Radio
                    id="radio2"
                    name="radio"
                    size="sm"
                    label="Form.Radio2"
                    className="mb-3 sm:mb-0"
                  />
                </Grid>
              </Grid>
            </Form>
          </Card.Body>
        </Card>
        <Card className="m-8">
          <Card.Header>Table</Card.Header>
          <Card.Body className="p-4 bg-gray-50">
            <Table size="md" border="row">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th">Name</Table.Cell>
                  <Table.Cell type="th">Title</Table.Cell>
                  <Table.Cell type="th">Email</Table.Cell>
                  <Table.Cell type="th">Role</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <Table.Row>
                  <Table.Cell type="th">Jane Cooper</Table.Cell>
                  <Table.Cell>Regional Paradigm Technician</Table.Cell>
                  <Table.Cell>jane.cooper@example.com</Table.Cell>
                  <Table.Cell>Admin</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">Cody Fisher</Table.Cell>
                  <Table.Cell>Product Directives Officer</Table.Cell>
                  <Table.Cell>cody.fisher@example.com</Table.Cell>
                  <Table.Cell>Owner</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">Kristin Watson</Table.Cell>
                  <Table.Cell>Lead Implementation Liaison</Table.Cell>
                  <Table.Cell>kristin.watson@example.com</Table.Cell>
                  <Table.Cell>Member</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </Card.Body>
        </Card>
        <Card className="m-8">
          <Card.Header>Progress</Card.Header>
          <Card.Body className="p-4 bg-gray-50">
            <Progress label={`${progress}%`} value={progress} />
          </Card.Body>
        </Card>
      </div>
    </ThemeProvider>
  );
}

export default Tailwind;
