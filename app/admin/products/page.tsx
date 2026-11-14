// Manage products — /admin/products. ADMIN role only: staff see an
// "Admins only" page instead of the catalogue. Unauthenticated users
// are redirected to /login by the middleware, and this page checks
// the session itself too (defense in depth), exactly like /admin.
// Test Admin Mode (demo mode, see DEMO_MODE.md): a signed-out
// visitor with the demo cookie sees the static catalogue with its
// starting states (Scalp scrub + Hair oil out of stock, Colour-care
// mask featured, Colour-care shampoo 15% off, Shampoo (1L) buy 2
// get 1 free) and every control disabled — nothing here can change
// anything. The shop shows only active products; removing one here
// sets active = false (the row stays, because orders reference
// product ids) and it can be re-activated from this page.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import {
  PRODUCTS,
  formatPrice,
  getDiscountLabel,
  type Product,
} from "@/lib/products";
import { getCatalogue } from "@/lib/products-db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isAuthConfigured } from "@/lib/auth/server";
import { getDemoOrSession } from "@/lib/auth/demo";
import {
  addProduct,
  setFeaturedProduct,
  setProductActive,
  updateProduct,
} from "./actions";
import DemoBanner from "@/components/DemoBanner";
import DemoPopover from "@/components/DemoPopover";

// The sale fields shared by the edit form (one per product) and the
// add form. A select picks the sale type and three number inputs
// carry the numbers; only the numbers for the chosen type are used
// (the server ignores the rest), so the form needs no JavaScript.
function SaleFields({
  product,
  disabled,
}: {
  product?: Product;
  disabled: boolean;
}) {
  const sale = product?.sale ?? null;
  return (
    <>
      <label>
        Sale offer
        <select
          name="saleType"
          defaultValue={sale?.type ?? "none"}
          disabled={disabled}
        >
          <option value="none">No sale</option>
          <option value="percent">Percent off</option>
          <option value="buyXGetY">Buy X get Y free</option>
        </select>
      </label>
      <label>
        Percent off (1–99, for a percent-off sale)
        <input
          name="salePercent"
          type="number"
          min="1"
          max="99"
          step="1"
          inputMode="numeric"
          defaultValue={sale?.type === "percent" ? sale.percent : ""}
          disabled={disabled}
        />
      </label>
      <label>
        Buy quantity (for a buy X get Y free sale)
        <input
          name="saleBuy"
          type="number"
          min="1"
          max="99"
          step="1"
          inputMode="numeric"
          defaultValue={sale?.type === "buyXGetY" ? sale.buy : ""}
          disabled={disabled}
        />
      </label>
      <label>
        Free quantity (for a buy X get Y free sale)
        <input
          name="saleGet"
          type="number"
          min="1"
          max="99"
          step="1"
          inputMode="numeric"
          defaultValue={sale?.type === "buyXGetY" ? sale.get : ""}
          disabled={disabled}
        />
      </label>
      <p>
        Only the numbers for the chosen sale type are used — leave the
        others blank.
      </p>
    </>
  );
}

export default async function AdminProductsPage() {
  // Test Admin Mode: a signed-out visitor with the demo cookie sees
  // the static catalogue below and never touches the real products
  // table. The auth-configured, session and admin-role checks only
  // apply outside demo mode, so demo works whether or not Supabase
  // is set up.
  const { demo, session } = await getDemoOrSession();
  if (!demo && !isAuthConfigured()) {
    return (
      <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
        <h1>Manage products — Lumen Hair Studio</h1>
        <p>
          <Link href="/admin">← Back to Admin</Link>
        </p>
        <p role="alert" className="alert-note">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. See AUTH.md.
        </p>
      </main>
    );
  }

  if (!demo) {
    if (!session) redirect("/login?next=/admin/products");

    if (session.profile.role !== "admin") {
      return (
        <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
          <h1>Manage products — Lumen Hair Studio</h1>
          <p>
            <Link href="/admin">← Back to Admin</Link>
          </p>
          <p role="alert">
            <strong>Admins only.</strong> You are signed in, but your account
            does not have the admin role. Ask an admin to promote you on
            the Admin page.
          </p>
          <p>
            Signed in as {session.user.email} ({session.profile.role}).
          </p>
        </main>
      );
    }
  }

  // In demo mode the page shows the static PRODUCTS list (never the
  // real table). Otherwise getCatalogue() reads the products table
  // when Supabase is configured and falls back to the same static
  // list when it is not — so the catalogue always renders, and the
  // notice below says plainly that edits need Supabase.
  const products: Product[] = demo ? PRODUCTS : await getCatalogue();
  const storageConfigured = isSupabaseConfigured();
  const storageError =
    !demo && !storageConfigured
      ? "Product storage is not configured (SUPABASE_SERVICE_ROLE_KEY missing), so products cannot be edited yet. See SHOP.md."
      : "";
  // Every control is disabled in demo mode, and when storage is not
  // configured (there is nowhere to save to). The DemoPopover only
  // ever appears in demo mode — a signed-in admin's buttons render
  // exactly as before, with no popover at all.
  const controlsDisabled = demo || !storageConfigured;
  const featured = products.find((p) => p.featured);

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>Manage products — Lumen Hair Studio</h1>
      <p>
        <Link href="/admin">← Back to Admin</Link> ·{" "}
        <Link href="/products">View the shop →</Link>
      </p>
      {demo && <DemoBanner />}
      {demo ? (
        <p>
          <strong>Test Admin Mode</strong> — sample data, no real account.
        </p>
      ) : session ? (
        <p>
          Signed in as <strong>{session.user.email}</strong> (admin).
        </p>
      ) : null}

      <section>
        <h2>Products ({products.length})</h2>
        <p>
          Edit a product below, remove one from the shop, or add a
          replacement. Removing a product hides it from the shop — the
          row stays, because past orders reference product ids — and
          it can be re-activated here. Only one product can be
          featured at a time: featuring one un-features the current
          one. Featured product:{" "}
          <strong>{featured ? featured.name : "None"}</strong>.
        </p>
        {storageError && (
          <p role="alert" className="alert-note">
            {storageError}
          </p>
        )}
        {products.length === 0 ? (
          <p>No products yet.</p>
        ) : (
          <div
            style={{ overflowX: "auto" }}
            tabIndex={0}
            role="region"
            aria-label="Products table"
          >
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Sale</th>
                  <th>Featured</th>
                  <th>Status</th>
                  <th className="actions-cell"><span className="actions-header-label">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td>
                        {p.name}
                        <br />
                        <small>{p.id}</small>
                      </td>
                      <td>{formatPrice(p.priceCents)}</td>
                      <td>{p.category}</td>
                      <td>
                        {p.inStock ? (
                          "In stock"
                        ) : (
                          <span className="badge badge-low">Out of stock</span>
                        )}
                      </td>
                      <td>{getDiscountLabel(p) ?? "—"}</td>
                      <td>
                        {p.featured ? (
                          <span className="badge badge-ok">Featured</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {p.active ? (
                          "In the shop"
                        ) : (
                          <span className="badge badge-low">
                            Removed from shop
                          </span>
                        )}
                      </td>
                      <td className="actions-cell">
                        {p.active && !p.featured ? (
                          <form
                            action={setFeaturedProduct}
                            style={{ display: "inline", marginRight: 8 }}
                          >
                            <input type="hidden" name="id" value={p.id} />
                            <DemoPopover enabled={demo}>
                              <button type="submit" disabled={controlsDisabled}>
                                Make featured
                              </button>
                            </DemoPopover>
                          </form>
                        ) : null}
                        <form
                          action={setProductActive}
                          style={{ display: "inline" }}
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={p.active ? "false" : "true"}
                          />
                          <DemoPopover enabled={demo}>
                            <button type="submit" disabled={controlsDisabled}>
                              {p.active ? "Remove from shop" : "Re-activate"}
                            </button>
                          </DemoPopover>
                        </form>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8}>
                        {/* One popover for the whole edit form, like
                            the settings form on /admin: every input
                            and the save button are disabled in demo
                            mode, so hovering anywhere on the form
                            explains why. */}
                        <DemoPopover enabled={demo} block>
                          <form action={updateProduct} className="lead-form">
                            <input type="hidden" name="id" value={p.id} />
                            <label>
                              Name
                              <input
                                name="name"
                                required
                                defaultValue={p.name}
                                disabled={controlsDisabled}
                              />
                            </label>
                            <label>
                              Price ($)
                              <input
                                name="price"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                required
                                defaultValue={(p.priceCents / 100).toFixed(2)}
                                disabled={controlsDisabled}
                              />
                            </label>
                            <label>
                              Description
                              <textarea
                                name="description"
                                rows={2}
                                defaultValue={p.description}
                                disabled={controlsDisabled}
                              />
                            </label>
                            <label>
                              Category
                              <input
                                name="category"
                                required
                                defaultValue={p.category}
                                disabled={controlsDisabled}
                              />
                            </label>
                            <label>
                              Image URL (https://…)
                              <input
                                name="image"
                                type="text"
                                inputMode="url"
                                defaultValue={p.image}
                                disabled={controlsDisabled}
                              />
                            </label>
                            <label>
                              Stock status
                              <select
                                name="inStock"
                                defaultValue={p.inStock ? "in" : "out"}
                                disabled={controlsDisabled}
                              >
                                <option value="in">In stock</option>
                                <option value="out">Out of stock</option>
                              </select>
                            </label>
                            <SaleFields
                              product={p}
                              disabled={controlsDisabled}
                            />
                            <button type="submit" disabled={controlsDisabled}>
                              Save changes
                            </button>
                          </form>
                        </DemoPopover>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Add a new product</h2>
        <p>
          Add a replacement when one is removed — for example, swap a
          discontinued product for a new one. The product id is made
          from the name (lowercase, spaces become hyphens), so a name
          that makes an id already in use is rejected — pick a
          different name. A new product starts in the shop and
          unfeatured; feature it from its row afterwards if it is
          the one.
        </p>
        <DemoPopover enabled={demo} block>
          <form action={addProduct} className="lead-form">
            <label>
              Name
              <input name="name" required disabled={controlsDisabled} />
            </label>
            <label>
              Price ($)
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Description
              <textarea name="description" rows={2} disabled={controlsDisabled} />
            </label>
            <label>
              Category
              <input name="category" required disabled={controlsDisabled} />
            </label>
            <label>
              Image URL (https://…)
              <input
                name="image"
                type="text"
                inputMode="url"
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Stock status
              <select name="inStock" defaultValue="in" disabled={controlsDisabled}>
                <option value="in">In stock</option>
                <option value="out">Out of stock</option>
              </select>
            </label>
            <SaleFields disabled={controlsDisabled} />
            <button type="submit" disabled={controlsDisabled}>
              Add product
            </button>
          </form>
        </DemoPopover>
      </section>
    </main>
  );
}
