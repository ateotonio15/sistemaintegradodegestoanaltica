import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GestaoVidas from "./GestaoVidas";
import VidasOperadora from "./VidasOperadora";

export default function Vidas() {
  const [tab, setTab] = useState("gestao");
  return (
    <div className="p-4 md:p-6">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="gestao">Gestão de Vidas</TabsTrigger>
          <TabsTrigger value="operadora">Vidas na Operadora</TabsTrigger>
        </TabsList>
        <TabsContent value="gestao" className="mt-4">
          <GestaoVidas />
        </TabsContent>
        <TabsContent value="operadora" className="mt-4">
          <VidasOperadora />
        </TabsContent>
      </Tabs>
    </div>
  );
}
