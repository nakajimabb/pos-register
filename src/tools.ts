import { ProductCategory } from './types';
import { QuerySnapshot } from 'firebase/firestore';

export const sortedProductCategories = (snapshot: QuerySnapshot<ProductCategory>) => {
  const flatten = (
    id: string,
    childrenIds: Map<string, string[]>,
    categories: Map<string, ProductCategory>,
    result: { id: string; productCategory: ProductCategory }[]
  ) => {
    const ids = childrenIds.get(id);
    const productCategory = categories.get(id);
    if (productCategory) result.push({ id, productCategory });
    if (ids) {
      ids.forEach((id) => {
        flatten(id, childrenIds, categories, result);
      });
    }
    return result;
  };

  const childrenIds = new Map<string, string[]>(); // parent_id, child_ids
  const categories = new Map<string, ProductCategory>(); // id, ProductCategory
  snapshot.docs.forEach((doc, i) => {
    const productCategory = doc.data();
    const docId = doc.id;
    const parentRef = productCategory.parentRef;
    const parentId = parentRef ? parentRef.id : '';
    const tmp = childrenIds.get(parentId);
    const ids = tmp ? tmp : [];
    ids.push(docId);
    categories.set(docId, productCategory);
    childrenIds.set(parentId, ids);
  });

  return flatten('', childrenIds, categories, []);
};


