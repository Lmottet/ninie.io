import { botCache } from "../../mod.ts";
import { getHarem } from "../services/feelsService.ts";
botCache.commands.set("harem", {
    name: `harem`,
    description: "Show the loveliest",
    execute: (message) => {
        console.log("test harem");
        getHarem();
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoYXJlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQU12RCxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7SUFDN0IsSUFBSSxFQUFFLE9BQU87SUFDYixXQUFXLEVBQUUsb0JBQW9CO0lBRWpDLE9BQU8sRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDMUIsUUFBUSxFQUFFLENBQUM7SUFDYixDQUFDO0NBQ0YsQ0FBQyxDQUFDIn0=