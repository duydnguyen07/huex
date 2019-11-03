import {getTable} from "@network-utils/arp-lookup";

export async function getOnlineMACAddresses() {
    console.log(await getTable());
}
