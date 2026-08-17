-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "shape" TEXT NOT NULL DEFAULT 'circle',
    "size" INTEGER NOT NULL DEFAULT 40,
    "gap" INTEGER NOT NULL DEFAULT 10,
    "borderWidth" INTEGER NOT NULL DEFAULT 1,
    "borderColor" TEXT NOT NULL DEFAULT '#D9D9D9',
    "selectedStyle" TEXT NOT NULL DEFAULT 'ring',
    "selectedColor" TEXT NOT NULL DEFAULT '#111111',
    "showLabels" BOOLEAN NOT NULL DEFAULT false,
    "showOptionName" BOOLEAN NOT NULL DEFAULT true,
    "maxVisible" INTEGER NOT NULL DEFAULT 0,
    "soldOutStyle" TEXT NOT NULL DEFAULT 'strikethrough',
    "hideNativeSelector" BOOLEAN NOT NULL DEFAULT true,
    "nativeSelectorCss" TEXT NOT NULL DEFAULT '',
    "updateUrl" BOOLEAN NOT NULL DEFAULT true,
    "preloadOnHover" BOOLEAN NOT NULL DEFAULT true,
    "swapImage" BOOLEAN NOT NULL DEFAULT true,
    "imageSelectorCss" TEXT NOT NULL DEFAULT '',
    "updateTitle" BOOLEAN NOT NULL DEFAULT true,
    "titleTemplate" TEXT NOT NULL DEFAULT '{{product_title}} — {{variant_title}}',
    "titleSelectorCss" TEXT NOT NULL DEFAULT '',
    "colorOptionNames" TEXT NOT NULL DEFAULT 'Color,Colour,Couleur,Farbe,Kleur,Colore,Color/Couleur',
    "customCss" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwatchValue" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'color',
    "colorHex" TEXT,
    "colorHex2" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwatchValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "ShopSettings_shop_idx" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "SwatchValue_shop_idx" ON "SwatchValue"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "SwatchValue_shop_optionName_value_key" ON "SwatchValue"("shop", "optionName", "value");
