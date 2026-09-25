'use client'

import { useMemo, type ReactNode } from 'react'
import { CUSTOMERS, CUSTOMER_BY_ID, PRODUCTS, PRODUCT_BY_ID } from '../mock/seed'
import { adjustStock, placeOrder, setOrderStatus, useMockStore } from '../mock/store'
import type { Role } from '../types'
import { StoreContext } from './context'
import type { StoreValue } from './types'

/** Modo demo: los datos viven en memoria y se pierden al recargar la página. */
export function DemoProvider({ role, userName, children }: { role: Role; userName: string; children: ReactNode }) {
  const mock = useMockStore()

  const value = useMemo<StoreValue>(
    () => ({
      status: 'ready',
      error: null,
      reload: () => {},
      live: true,
      products: PRODUCTS,
      productById: PRODUCT_BY_ID,
      customers: CUSTOMERS,
      customerById: CUSTOMER_BY_ID,
      stock: mock.stock,
      orders: mock.orders,
      unmet: mock.unmet,
      movements: mock.movements,
      placeOrder: async input => placeOrder({ ...input, by: userName }),
      setOrderStatus: async (id, to, reason) => setOrderStatus(id, to, role, userName, reason),
      adjustStock: async (id, qty, note) => adjustStock(id, qty, role, userName, note),
    }),
    [mock, role, userName],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
