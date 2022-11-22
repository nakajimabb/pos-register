import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from './AppContext';
import { Button, Grid } from './components';

const MenuList: React.FC = () => {
  const { role, currentShop } = useAppContext();
  return (
    <Grid cols="6" gap="2" className="mt-16 p-4">
      <div>
        <Link to="/purchase_new">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            仕入処理
          </Button>
        </Link>
        <Link to="/purchase_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            仕入一覧
          </Button>
        </Link>
        <Link to="/internal_order_new">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            社内発注
          </Button>
        </Link>
        <Link to="/purchase_new">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            社内発注一覧
          </Button>
        </Link>
      </div>
      <div>
        <Link to="/delivery_new">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            出庫処理
          </Button>
        </Link>
        <Link to="/delivery_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            出庫一覧
          </Button>
        </Link>
      </div>
      <div>
        <Link to="/rejection_new">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            廃棄・返品処理
          </Button>
        </Link>
        <Link to="/rejection_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            廃棄・返品一覧
          </Button>
        </Link>
        {role === 'manager' && (
          <Link to="/rejection_confirm">
            <Button variant="outlined" size="lg" className="w-48 m-2">
              廃棄・返品承認
            </Button>
          </Link>
        )}
      </div>
      <div>
        <Link to="/invetory_new">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            棚卸処理
          </Button>
        </Link>
        <Link to="/invetory_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            棚卸一覧
          </Button>
        </Link>
        {role === 'manager' && (
          <>
            <Link to="/invetory_all">
              <Button variant="outlined" size="lg" className="w-48 m-2">
                棚卸モニタ
              </Button>
            </Link>
            <Link to="/import_stocks">
              <Button variant="outlined" size="lg" className="w-48 m-2">
                在庫数取込
              </Button>
            </Link>
          </>
        )}
      </div>
      <div>
        <Link to="/products">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            商品マスタ(共通)
          </Button>
        </Link>
        <Link to="/shop_products">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            店舗商品マスタ
          </Button>
        </Link>
        <Link to="/import_products">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            商品マスタ取込
          </Button>
        </Link>
        <Link to="/product_categories">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            商品カテゴリ
          </Button>
        </Link>
        <Link to="/product_bundle_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            バンドル
          </Button>
        </Link>
        <Link to="/product_bulk_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            セット
          </Button>
        </Link>
        <Link to="/unregistered_products">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            未登録商品
          </Button>
        </Link>
        <Link to="/item_trend_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            商品動向
          </Button>
        </Link>
      </div>
      <div>
        <Link to="/shops">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            店舗一覧
          </Button>
        </Link>
        <Link to="/suppliers">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            仕入先マスタ
          </Button>
        </Link>
        <Link to="/import_suppliers">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            仕入先マスタ取込
          </Button>
        </Link>
        <Link to="/sales_summary_list">
          <Button variant="outlined" size="lg" className="w-48 m-2">
            売上帳票
          </Button>
        </Link>
        {role === 'manager' && (
          <Link to="/sales_delivery_list">
            <Button variant="outlined" size="lg" className="w-48 m-2">
              売上仕入対比表
            </Button>
          </Link>
        )}
      </div>
    </Grid>
  );
};

export default MenuList;
